import React, { createContext, useState, ReactNode } from 'react';

// 定义 VolumeContext 的类型
interface VolumeContextType {
    userVolume: number;
    setUserVolume: (volume: number) => void;
    botVolume: number;
    setBotVolume: (volume: number) => void;
}

// 创建上下文并为其指定类型，初始值设为 null
const VolumeContext = createContext<VolumeContextType | null>(null);

// 定义 VolumeProvider 组件的 props 类型
interface VolumeProviderProps {
    children: ReactNode;
}

const VolumeProvider: React.FC<VolumeProviderProps> = ({ children }) => {
    const [userVolume, setUserVolume] = useState<number>(0);
    const [botVolume, setBotVolume] = useState<number>(0);

    return (
        <VolumeContext.Provider value={{ userVolume, setUserVolume, botVolume, setBotVolume }}>
            {children}
        </VolumeContext.Provider>
    );
};

export { VolumeContext, VolumeProvider };
