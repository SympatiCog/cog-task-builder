import { Toolbar } from "./components/Toolbar";
import { JsonPreview } from "./components/JsonPreview";

export default function App() {
  return (
    <div className="flex h-full flex-col bg-slate-50 text-slate-900">
      <Toolbar />
      <main className="flex-1 overflow-hidden">
        <JsonPreview />
      </main>
    </div>
  );
}
