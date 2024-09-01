# Copyright (c) 2024 Binbin Zhang(binbzha@qq.com)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import json
import os
import uuid
import wave

import edge_tts
from openai import OpenAI
import numpy as np
import tornado.ioloop
import tornado.web
import tornado.websocket
import wenet

import config
from vad import Vad, VadState


class LLM:

    def __init__(self):
        self.client = OpenAI(api_key=config.OPENAI_API_KEY,
                             base_url=config.OPENAI_BASE_URL)
        self.history = []

    def predict(self, message):
        history_openai_format = []
        for human, assistant in self.history:
            history_openai_format.append({"role": "user", "content": human})
            history_openai_format.append({
                "role": "assistant",
                "content": assistant
            })
        history_openai_format.append({"role": "user", "content": message})
        response = self.client.chat.completions.create(
            model=config.LLM_MODEL,
            messages=history_openai_format,
            temperature=1.0,
            stream=True)
        partial_message = ""
        for chunk in response:
            if chunk.choices[0].delta.content is not None:
                partial_message = partial_message + chunk.choices[
                    0].delta.content
        self.history.append((message, partial_message))
        return partial_message


class WebSocketHandler(tornado.websocket.WebSocketHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.total_audio = b''
        self.vad = Vad(model_dir=config.VAD_MODEL)
        self.asr = wenet.load_model(config.WENET_MODEL)
        self.llm = LLM()
        self.speech = []
        self.id = str(uuid.uuid1())
        self.index = 0
        self.save_dir = 'wav'

    def check_origin(self, origin):
        return True

    def open(self):
        print("WebSocket opened")

    def on_message(self, message):
        self.total_audio += message
        pcm_data = np.frombuffer(message, dtype=np.int16)
        # VAD
        states, audios = self.vad.add_audio(pcm_data)
        for s, a in zip(states, audios):
            if s == VadState.SPEECH_START:
                print('Speech start')
                self.speech.append(a)
            elif s == VadState.SPEECH:
                self.speech.append(a)
            elif s == VadState.SPEECH_END:
                print('Speech end')
                self.speech.append(a)
                speech_segment = np.concatenate(self.speech, axis=0)
                fname = os.path.join(self.save_dir, self.id,
                                     f'{self.index}.wav')
                self.write_wav(fname, speech_segment.tobytes())
                result = self.asr.transcribe(fname)
                user_msg = result['text']
                if user_msg != '':
                    print('User:', user_msg)
                    # LLM
                    assistant_msg = self.llm.predict(user_msg)
                    print('Assistant:', assistant_msg)
                    communicate = edge_tts.Communicate(assistant_msg,
                                                       config.TTS_SPEAKER)
                    # TTS
                    rdata = b''
                    for chunk in communicate.stream_sync():
                        if chunk["type"] == "audio":
                            rdata += chunk['data']
                            # TODO(Binbin Zhang): streaming send
                        elif chunk["type"] == "WordBoundary":
                            print(f"WordBoundary: {chunk}")
                    self.write_message(rdata, True)
                self.speech = []
                self.index += 1

    def write_wav(self, file_name, data):
        parent_dir = os.path.dirname(file_name)
        if not os.path.exists(parent_dir):
            os.makedirs(parent_dir)
        with wave.open(file_name, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(16000)
            wf.writeframes(data)

    def on_close(self):
        print("WebSocket closed")
        save_path = os.path.join(self.save_dir, self.id, 'all.wav')
        self.write_wav(save_path, self.total_audio)


class MainHandler(tornado.web.RequestHandler):

    def set_default_headers(self):
        self.set_header('Access-Control-Allow-Origin', '*')
        self.set_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.set_header('Access-Control-Allow-Headers', 'Content-Type')

    def get(self):
        print(f"GET 请求参数：{self.request.arguments}")
        self.write("Hello, Tornado!")

    def post(self):
        print(f"POST 请求参数：{self.request.arguments}")
        data = json.loads(self.request.body)
        print(data)
        self.write("Hello, Tornado!")


def make_app():
    return tornado.web.Application([
        (r"/chat", WebSocketHandler),
        (r"/", MainHandler),
    ])


if __name__ == "__main__":
    app = make_app()
    app.listen(config.PORT)
    tornado.ioloop.IOLoop.current().start()
