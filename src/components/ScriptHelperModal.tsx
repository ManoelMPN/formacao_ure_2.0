import React, { useState } from 'react';
import { X, Copy, Check, ExternalLink, HelpCircle, AlertCircle, ArrowRight, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';
import { getRecommendedAppsScriptCode } from '../services/sheetService';

interface ScriptHelperModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUrl: string;
  onSaveUrl: (newUrl: string) => Promise<void>;
  isMockData: boolean;
  onUseSampleData: () => void;
}

export const ScriptHelperModal: React.FC<ScriptHelperModalProps> = ({
  isOpen,
  onClose,
  currentUrl,
  onSaveUrl,
  isMockData,
  onUseSampleData,
}) => {
  const [urlInput, setUrlInput] = useState(currentUrl);
  const [isCopied, setIsCopied] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const scriptCode = getRecommendedAppsScriptCode();

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(scriptCode);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setIsTesting(true);
    setTestResult(null);

    try {
      await onSaveUrl(urlInput.trim());
      setTestResult({
        success: true,
        message: 'Conexão testada e dados sincronizados com sucesso!',
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Não foi possível conectar. Verifique as permissões de acesso da implantação.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Conexão em Tempo Real com o Google Sheets
              </h2>
              <p className="text-xs text-slate-500">
                Como liberar o acesso da planilha para visualização no app e no Vercel
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Important alert regarding SEDUC @prof.educacao.sp.gov.br */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-900 text-xs sm:text-sm">
            <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold block text-amber-900 mb-1">
                Atenção ao publicar pelo e-mail institucional (@prof.educacao.sp.gov.br)
              </strong>
              <p className="text-amber-800 leading-relaxed">
                Ao implantar o Web App no Google Apps Script, se a opção <strong>"Quem pode acessar"</strong> estiver definida como <em>"Qualquer pessoa do domínio SEDUC"</em>, o Google exigirá login e bloqueará a leitura direta no Vercel e no celular. Para funcionar em tempo real sem pedir login, configure a implantação como <strong>"Quem pode acessar: Qualquer pessoa"</strong>.
              </p>
            </div>
          </div>

          {/* Form to paste / update URL */}
          <form onSubmit={handleTestAndSave} className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              URL do App da Web (Google Apps Script)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="flex-1 px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={isTesting}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs shrink-0"
              >
                <RefreshCw className={`w-4 h-4 ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'Testando...' : 'Salvar e Conectar'}</span>
              </button>
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                  testResult.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {testResult.success ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </form>

          {/* Step-by-step setup */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span>Passo a Passo para o Apps Script ler todas as abas automaticamente:</span>
            </h3>
            <ol className="space-y-3 text-xs sm:text-sm text-slate-700">
              <li className="flex gap-2.5">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center shrink-0 text-xs">
                  1
                </span>
                <span>
                  Na sua planilha <strong>FORMAÇÕES URE SUL 2º SMESTRE</strong>, clique no menu superior em <strong>Extensões</strong> &gt; <strong>Apps Script</strong>.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center shrink-0 text-xs">
                  2
                </span>
                <div>
                  <span>Apague o código existente e cole o código abaixo (ele já lê todas as abas e cria os dados automaticamente):</span>
                  <div className="mt-2 relative">
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="absolute top-2 right-2 px-2.5 py-1 bg-slate-800 text-white rounded-md text-xs font-medium hover:bg-slate-700 flex items-center gap-1 transition-colors"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{isCopied ? 'Copiado!' : 'Copiar Código'}</span>
                    </button>
                    <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-[11px] overflow-x-auto max-h-48 font-mono leading-relaxed">
                      {scriptCode}
                    </pre>
                  </div>
                </div>
              </li>
              <li className="flex gap-2.5">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center shrink-0 text-xs">
                  3
                </span>
                <div>
                  <span>Clique no botão azul <strong>Implantar</strong> &gt; <strong>Nova implantação</strong>:</span>
                  <ul className="list-disc pl-5 mt-1 space-y-1 text-xs text-slate-600">
                    <li>Tipo: selecione a engrenagem e marque <strong>App da Web</strong></li>
                    <li>Executar como: <strong>Eu (seu e-mail)</strong></li>
                    <li>
                      Quem pode acessar: escolha <strong className="text-blue-700">Qualquer pessoa</strong> (necessário para a consulta pública e responsiva no app/Vercel)
                    </li>
                  </ul>
                </div>
              </li>
              <li className="flex gap-2.5">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center shrink-0 text-xs">
                  4
                </span>
                <span>
                  Copie o <strong>URL do aplicativo da Web</strong> gerado e cole no campo acima para sincronizar na hora!
                </span>
              </li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button
            type="button"
            onClick={onUseSampleData}
            className="text-xs text-slate-600 hover:text-slate-900 font-medium underline underline-offset-2"
          >
            Restaurar dados de demonstração da URE Sul 3
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
