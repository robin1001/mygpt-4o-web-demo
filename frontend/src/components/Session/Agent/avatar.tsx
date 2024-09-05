import { useCallback, useEffect, useRef, useContext } from "react";

import FaceSVG from "./face.svg";

import styles from "./styles.module.css";
import { VolumeContext } from "../VolumeContext";

export const Avatar: React.FC = () => {
  const { userVolume, setUserVolume, botVolume, setBotVolume } = useContext(VolumeContext);
  const volRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (volRef.current) {
      volRef.current.style.transform = `scale(${Math.max(1, 1 + botVolume)})`;
    }
  }, [botVolume]);


  return (
    <>
      <img src={FaceSVG} alt="Face" className={styles.face} />
      <div className={styles.faceBubble} ref={volRef} />
    </>
  );
};

export default Avatar;
