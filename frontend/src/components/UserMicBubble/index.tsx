import React, { useEffect, useRef, useContext } from "react";
import clsx from "clsx";
import { Mic, MicOff, Pause, Volume } from "lucide-react";

import { VolumeContext } from "../Session/VolumeContext";
import styles from "./styles.module.css";

const AudioIndicatorBubble: React.FC = (props: { volume: number }) => {
  const { userVolume, setUserVolume, botVolume, setBotVolume } = useContext(VolumeContext);
  const volRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (volRef.current) {
      const v = userVolume * 1.75;
      volRef.current.style.transform = `scale(${Math.max(0.2, v)})`;
    }
  }, [userVolume]);

  return <div ref={volRef} className={styles.volume} />;
};

interface Props {
  active: boolean;
  muted: boolean;
  handleMute: () => void;
}

export default function UserMicBubble({
  active,
  muted = false,
  handleMute,
}: Props) {
  const canTalk = !muted && active;

  const cx = clsx(
    muted && active && styles.muted,
    !active && styles.blocked,
    canTalk && styles.canTalk
  );

  return (
    <div className={`${styles.bubbleContainer}`}>
      <div className={`${styles.bubble} ${cx}`} onClick={() => handleMute()}>
        <div className={styles.icon}>
          {!active ? (
            <Pause size={42} className="size-8 md:size-10" />
          ) : canTalk ? (
            <Mic size={42} className="size-8 md:size-10" />
          ) : (
            <MicOff size={42} className="size-8 md:size-10" />
          )}
        </div>
        {canTalk && <AudioIndicatorBubble />}
      </div>
    </div>
  );
}
