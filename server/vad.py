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

from enum import Enum

import numpy as np
import torch


class VadState(Enum):
    SILENCE = '-'
    SPEECH = '*'
    SPEECH_START = '^'
    SPEECH_END = '$'


class Vad:

    def __init__(self,
                 k_silence_to_speech=5,
                 k_speech_to_silence=10,
                 model_dir=None):
        print('Load VAD model')
        if model_dir:
            self.model, _ = torch.hub.load(repo_or_dir=model_dir,
                                           model='silero_vad',
                                           source='local')
        else:
            self.model, _ = torch.hub.load(repo_or_dir='snakers4/silero-vad',
                                           model='silero_vad')
        self.sample_rate = 16000
        self.chunk_size = int(0.032 * self.sample_rate)  # 32ms chunk_size
        self.k_silence_to_speech = k_silence_to_speech
        self.k_speech_to_silence = k_speech_to_silence
        self.reset()

    def reset(self):
        self.state = VadState.SILENCE
        self.left_audio = None  # left audio in last
        self.confidences = []
        self.num_speech_frames = 0
        self.num_silence_frames = 0
        self.audios = []
        self.states = []
        self.return_offset = 0

    def state_machine(self, is_speech):
        if self.state == VadState.SILENCE:
            self.states.append(VadState.SILENCE)
            if is_speech:
                self.num_speech_frames += 1
                if self.num_speech_frames > self.k_silence_to_speech:
                    self.state = VadState.SPEECH
                    self.num_silence_frames = 0
                    # Overwrite cached states
                    speech_start = max(
                        0,
                        len(self.states) - self.k_silence_to_speech)
                    self.states[speech_start] = VadState.SPEECH_START
                    for k in range(speech_start + 1, len(self.states)):
                        self.states[k] = VadState.SPEECH
            else:
                self.num_speech_frames = 0
        else:
            self.states.append(VadState.SPEECH)
            if not is_speech:
                self.num_silence_frames += 1
                if self.num_silence_frames > self.k_speech_to_silence:
                    self.states[-1] = VadState.SPEECH_END
                    self.state = VadState.SILENCE
                    self.num_speech_frames = 0
            else:
                self.num_silence_frames = 0

    def add_audio(self, pcm, last_frame=False):
        # Avoid large memory usage
        if len(self.audios) > int(1 / 0.032 * 60 * 10):
            self.reset()

        if self.left_audio is not None:
            audio = np.concatenate((self.left_audio, pcm), axis=0)
        else:
            audio = pcm
        num_frames = int((audio.shape[0] - 1) / self.chunk_size)
        for i in range(num_frames):
            audio_chunk = audio[i * self.chunk_size:(i + 1) * self.chunk_size]
            confidence = self.model(torch.from_numpy(audio_chunk),
                                    self.sample_rate).item()
            self.confidences.append(confidence)
            is_speech = confidence > 0.5
            self.state_machine(is_speech)
            self.audios.append(audio_chunk)

        self.left_audio = audio[num_frames * self.chunk_size:]
        assert len(self.audios) == len(self.states)
        if last_frame and self.state == VadState.SPEECH:
            self.states[-1] = VadState.SPEECH_END
        if not last_frame and self.state == VadState.SILENCE:
            # Cache k_silence_to_speech fames
            end = max(len(self.states) - self.k_silence_to_speech, 0)
        else:
            end = len(self.states)
        start = self.return_offset
        self.return_offset = end
        return self.states[start:end], self.audios[start:end]


def print_speech_segments(states):
    s = 0
    while s < len(states):
        while s < len(states) and states[s] != VadState.SPEECH_START:
            s += 1
        e = s + 1
        while e < len(states) and states[e] != VadState.SPEECH_END:
            e += 1
        if s < len(states):
            print('speech segments: {:.2f} {:.2f}'.format(
                s * 0.032, e * 0.032))
        s = e + 1


if __name__ == '__main__':
    import sys
    import torchaudio
    print('load wav...')
    audio, sample_rate = torchaudio.load(sys.argv[1])
    audio = audio[0].numpy()  # get the first channel
    vad = Vad()
    print('non-streaming result')
    states, audios = vad.add_audio(audio, True)
    print_speech_segments(states)

    print('')
    print('streaming result')
    ss = []
    interval = 160
    for i in range(0, audio.shape[0], interval):
        s, _ = vad.add_audio(audio[i:i + interval])
        ss.extend(s)
    print_speech_segments(ss)
