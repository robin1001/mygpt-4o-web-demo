import Session from "./components/Session";
import { VolumeProvider } from "./components/Session/VolumeContext";

export default function App() {
  return (
    <VolumeProvider>
      <Session />
    </VolumeProvider>
  );
}
