import React, { useEffect } from "react";
import { Book, Info } from "lucide-react";
import { VAD } from "web-vad";

import { Button } from "./components/ui/button";

type SplashProps = {
  handleReady: () => void;
};

export const Splash: React.FC<SplashProps> = ({ handleReady }) => {
  const [isReady, setIsReady] = React.useState(false);

  useEffect(() => {
    const cacheVAD = async () => {
      await VAD.precacheModels("silero_vad.onnx");
      setIsReady(true);
    };
    cacheVAD();
  }, []);

  return (
    <main className="w-full h-full flex items-center justify-center bg-primary-200 p-4 bg-[length:auto_50%] lg:bg-auto bg-colorWash bg-no-repeat bg-right-top">
      <div className="flex flex-col gap-8 lg:gap-12 items-center max-w-full lg:max-w-3xl">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl text-balance text-left">
          MyGPT-4o
        </h1>

        <Button onClick={handleReady} disabled={!isReady}>
          {isReady ? "Try demo" : "Downloading assets..."}
        </Button>

      </div>
    </main>
  );
};

export default Splash;
