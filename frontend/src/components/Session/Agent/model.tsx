import React from "react";

import styles from "./styles.module.css";

const ModelBadge: React.FC = () => {
  const [model, setModel] = React.useState<string | undefined>("MyGPT-4o");

  return <div className={styles.modelBadge}>{model}</div>;
};

export default ModelBadge;
