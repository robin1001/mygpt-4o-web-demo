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

import numpy as np
import tornado.ioloop
import tornado.web
import tornado.websocket
import wenet

import config
from vad import Vad, VadState


class WebSocketHandler(tornado.websocket.WebSocketHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.total_audio = b''
        self.vad = Vad(model_dir=config.VAD_MODEL)
        self.asr = wenet.load_model(config.WENET_MODEL)
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
            # print(s, a)
            # print(s)
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
                print(result['text'])
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
