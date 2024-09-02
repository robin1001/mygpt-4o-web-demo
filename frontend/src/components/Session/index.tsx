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
    const audioContextRef = useRef<AudioContext>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const socketRef = useRef<WebSocket | null>(null);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const sourceBufferRef = useRef<SourceBuffer | null>(null);
    const mediaSourceRef = useRef<MediaSource | null>(null);
    const pendingChunksRef = useRef<ArrayBuffer[]>([]); // 用于存储待处理的数据块

    // ---- Effects
    useEffect(() => {
      // Create new stats aggregator on mount (removes stats from previous session)
      stats_aggregator = new StatsAggregator();
    }, []);


    useEffect(() => {
      // 创建 AudioContext，并指定采样率（例如 44100 Hz）
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          if (!audioContextRef.current) {
            audioContextRef.current = new AudioContext({ sampleRate: 16000 });
          }
          const source = audioContextRef.current.createMediaStreamSource(stream);
          const scriptProcessor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
          source.connect(scriptProcessor);
          scriptProcessor.connect(audioContextRef.current.destination);
          scriptProcessor.onaudioprocess = function (event) {
            const inputBuffer = event.inputBuffer;
            const channelData = inputBuffer.getChannelData(0);
            const v = computeVolume(channelData);
            setVolume(v);
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


    useEffect(() => {
      const mediaSource = new MediaSource();
      mediaSourceRef.current = mediaSource;

      mediaSource.addEventListener('sourceopen', () => {
        if (mediaSourceRef.current) {
          const sourceBuffer = mediaSourceRef.current.addSourceBuffer('audio/mpeg;');
          sourceBufferRef.current = sourceBuffer;
          // 监听 sourceBuffer 的更新状态
          sourceBuffer.addEventListener('updateend', () => {
            if (pendingChunksRef.current.length > 0 && !sourceBuffer.updating) {
              sourceBuffer.appendBuffer(pendingChunksRef.current.shift()!);
            }
          });
        }
      });

      if (audioRef.current && mediaSourceRef.current) {
        audioRef.current.src = URL.createObjectURL(mediaSourceRef.current);
      }

      return () => {
        if (mediaSourceRef.current) {
          mediaSourceRef.current.endOfStream();
        }
      };
    }, []);


    useEffect(() => {
      if (!socketRef.current) {
        socketRef.current = new WebSocket(SERVER_URL);
        socketRef.current.binaryType = 'arraybuffer';
        socketRef.current.onopen = () => {
          console.log('WebSocket 连接已建立');
        };

        socketRef.current.onerror = (error) => {
          console.error('WebSocket 错误: ', error);
        };

        socketRef.current.onclose = () => {
          console.log('WebSocket 连接已关闭');
        };

        socketRef.current.onmessage = (event) => {
          if (sourceBufferRef.current && !sourceBufferRef.current.updating) {
            sourceBufferRef.current.appendBuffer(event.data);
          } else {
            // 如果正在更新，将数据存储到待处理队列中
            pendingChunksRef.current.push(event.data);
          }
        }
      }

      return () => {
        if (socketRef.current) {
          socketRef.current?.close();
        }
      }
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


    function computeVolume(float32Array: Float32Array): number {
      let sum = 0;
      // Iterate over the Float32Array and convert each value
      for (let i = 0; i < float32Array.length; i++) {
        sum += Math.abs(float32Array[i]);
      }
      const average = sum / float32Array.length;
      const level = average * 10;
      return level < 1.0 ? level : 1.0;
    }

    const style = {
      visibility: 'hidden' // 或 'visible'
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
          <audio ref={audioRef} controls autoPlay style={style} />;
        </div>
      </>
    );
  },
);

export default Session;
