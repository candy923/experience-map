import { useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { FlowEditor } from './components/FlowEditor/FlowEditor';
import { PhonePreview } from './components/PhonePreview/PhonePreview';
import { ScenarioChat } from './components/ScenarioChat/ScenarioChat';
import { useFlowStore } from './hooks/useFlowStore';

export default function App() {
  const init = useFlowStore((s) => s.init);
  const ready = useFlowStore((s) => s.ready);

  useEffect(() => {
    init();
  }, [init]);

  if (!ready) {
    return (
      <div className="flex h-screen w-screen bg-[#0a0f1a] items-center justify-center">
        <div className="text-slate-500 text-sm">加载中...</div>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-screen bg-[#0a0f1a] overflow-hidden">
        <div className="flex-1 min-w-0 h-full border-r border-slate-800">
          <FlowEditor />
        </div>
        <div className="w-[420px] shrink-0 h-full border-r border-slate-800 overflow-y-auto">
          <PhonePreview />
        </div>
        <div className="w-[340px] shrink-0 h-full">
          <ScenarioChat />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
