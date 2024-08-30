import React, { useEffect, useRef, useState } from "react";

import StatsAggregator from "../../utils/stats_aggregator";
import * as Card from "../ui/card";
import UserMicBubble from "../UserMicBubble";

import Agent from "./Agent";
import { arrayBuffer } from "stream/consumers";

let stats_aggregator: StatsAggregator;

const SERVER_URL = 'ws://127.0.0.1:8888/chat'

export const Session = React.memo(
  () => {
    const [showStats, setShowStats] = useState(false);
    const [volume, setVolume] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const socketRef = useRef<WebSocket | null>(null);
    const audioContext = new AudioContext({ sampleRate: 16000 });

    // ---- Effects
    useEffect(() => {
      // Create new stats aggregator on mount (removes stats from previous session)
      stats_aggregator = new StatsAggregator();
    }, []);

    useEffect(() => {
      // 创建 AudioContext，并指定采样率（例如 44100 Hz）
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          const source = audioContext.createMediaStreamSource(stream);
          const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
          source.connect(scriptProcessor);
          scriptProcessor.connect(audioContext.destination);
          scriptProcessor.onaudioprocess = function (event) {
            const inputBuffer = event.inputBuffer;
            const channelData = inputBuffer.getChannelData(0);
            const pcm_data = float32ToInt16(channelData);
            if (socketRef.current) {
              if (socketRef.current.readyState === WebSocket.OPEN) {
                socketRef.current.send(pcm_data.buffer);
              }
            }
          };
        })
        .catch(error => {
          console.error('获取媒体流失败:', error);
        });

    }, []);

    function float32ToInt16(float32Array: Float32Array): Int16Array {
      // Create a new Int16Array with the same length as the Float32Array
      let int16Array = new Int16Array(float32Array.length);

      // Iterate over the Float32Array and convert each value
      for (let i = 0; i < float32Array.length; i++) {
        // Scale the float to fit within the range of Int16
        int16Array[i] = Math.max(-32768, Math.min(32767, Math.floor(float32Array[i] * 32767)));
      }

      return int16Array;
    }

    // useEffect(() => {
    //   navigator.mediaDevices.getUserMedia({ audio: true }).then(
    //     stream => {
    //       mediaRecorderRef.current = new MediaRecorder(stream);
    //       audioContextRef.current = new AudioContext();
    //       const source = audioContextRef.current.createMediaStreamSource(stream);
    //       analyserRef.current = audioContextRef.current.createAnalyser();
    //       analyserRef.current.smoothingTimeConstant = 0.0;
    //       analyserRef.current.fftSize = 1024;
    //       source.connect(analyserRef.current);
    //       mediaRecorderRef.current.ondataavailable = (event) => {
    //         if (socketRef.current) {
    //           if (socketRef.current.readyState === WebSocket.OPEN) {
    //             socketRef.current.send(event.data);
    //           }
    //         }
    //       };
    //       mediaRecorderRef.current.start(1000);
    //     }
    //   );

    //   return () => {
    //     if (mediaRecorderRef.current) {
    //       mediaRecorderRef.current.stop();
    //     }
    //   }
    // }, []);

    useEffect(() => {
      if (!socketRef.current) {
        socketRef.current = new WebSocket(SERVER_URL);
        socketRef.current.onopen = () => {
          console.log('WebSocket 连接已建立');
        };

        socketRef.current.onerror = (error) => {
          console.error('WebSocket 错误: ', error);
        };

        socketRef.current.onclose = () => {
          console.log('WebSocket 连接已关闭');
        };

        socketRef.current.onmessage = async (e) => {
          console.log('recv', e.data);
          await blobToArrayBuffer(e.data).then(arrayBuffer => {
            if (audioContextRef.current) {
              audioContextRef.current.decodeAudioData(arrayBuffer).then(buffer => {
                let source = audioContextRef.current.createBufferSource();
                source.buffer = buffer;
                source.connect(audioContextRef.current.destination);
                source.start(0);
              }).catch(derror => {
                console.log('decode audio error:', derror);
              });
            }
          }).catch(error => {
            console.log(error);
          });
        }
      }

      return () => {
        if (socketRef.current) {
          socketRef.current?.close();
        }
      }
    }, []);

    useEffect(() => {
      const interval = setInterval(() => {
        const v = getVolumeLevel();
        setVolume(v);
      }, 100);
      return () => clearInterval(interval);
    }, []);

    function getVolumeLevel(): number {
      if (analyserRef.current) {
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const level = average / 255 * 10;
        return level < 1.0 ? level : 1.0;
      }
      return 0;
    }

    const blobToArrayBuffer = (blob: Blob): Promise<ArrayBuffer> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (event) {
          resolve(event.target?.result as ArrayBuffer);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
      });
    };

    return (
      <>
        <div className="flex-1 flex flex-col items-center justify-center w-full">
          <Card.Card
            fullWidthMobile={false}
            className="w-full max-w-[320px] sm:max-w-[420px] mt-auto shadow-long"
          >
            <Agent
              isReady={true}
              statsAggregator={stats_aggregator}
            />
          </Card.Card>
          <UserMicBubble
            active={true}
            muted={false}
            handleMute={() => { }}
            volume={volume}
          />
        </div>
      </>
    );
  },
);

export default Session;
