import { useEffect, useRef } from "react";

import styles from "./styles.module.css";

export const AudioIndicatorBar: React.FC = () => {
  const volRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (volRef.current) {
      const volume = 1.0;
      volRef.current.style.width = Math.max(2, volume * 100) + "%";
    }
  }, []);

  return <div ref={volRef} className={styles.volume} />;
};

useEffect(() => {

});

return (
  <div className={styles.bar}>
    <div ref={volRef} />
  </div>
);
};

export default AudioIndicatorBar;
