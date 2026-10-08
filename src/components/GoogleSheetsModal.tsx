import React, { useState, useRef } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Copy,
  RefreshCw,
  Database,
  UploadCloud,
  FileSpreadsheet,
} from 'lucide-react';
import {
  fetchSheetData,
  DEFAULT_SCRIPT_URL,
  getRecommendedAppsScriptCode,
  parseExcelBuffer,
} from '../services/sheetService';
import { SheetState } from '../types';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUrl: string;
  onSaveUrl: (newUrl: string) => Promise<boolean>;
  onUploadLocalSpreadsheet?: (state: SheetState) => void;
  sheetTitle?: string;
  sheetUpdatedAt: string | null;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  currentUrl,
  onSaveUrl,
  onUploadLocalSpreadsheet,
  sheetTitle,
  sheetUpdatedAt,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'apps_script'>('upload');
  const [urlInput, setUrlInput] = useState(currentUrl);
  const [isTesting, setIsTesting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: string;
  } | null>(null);

  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    message: string;
    details?: string;
  } | null>(null);

  const [copiedCode, setCopiedCode] = useState(false);
  const [showCode, setShowCode] = useState(false);

  if (!isOpen) return null;

  const handleProcessFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setUploadResult({
        success: false,
        message: 'Formato de arquivo inválido.',
        details: 'Por favor, selecione um arquivo de planilha (.xlsx, .xls ou .csv).',
      });
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const res = parseExcelBuffer(buffer, file.name);

      if (res.error || !res.state) {
        setUploadResult({
          success: false,
          message: 'Não foi possível processar a planilha.',
          details: res.error || 'Erro desconhecido ao ler o arquivo.',
        });
      } else {
        if (onUploadLocalSpreadsheet) {
          onUploadLocalSpreadsheet(res.state);
        }
        const schoolsCount = res.state.allSchools?.length || 0;
        const compsCount = Object.keys(res.state.components || {}).length;
        const totalRows = Object.values(res.state.components || {}).reduce(
          (acc, c) => acc + (c.records?.length || 0),
          0
        );

        setUploadResult({
          success: true,
          message: 'Planilha carregada e processada com sucesso!',
          details: `Arquivo: "${file.name}" • ${schoolsCount} escolas detectadas • ${compsCount} abas de componentes • ${totalRows} registros nominais.`,
        });
      }
    } catch (err: any) {
      setUploadResult({
        success: false,
        message: 'Erro ao ler arquivo local.',
        details: err?.message || String(err),
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleProcessFile(files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleTestAndSave = async () => {
    const trimmed = urlInput.trim().replace(/^['"]|['"]$/g, '');
    if (!trimmed) {
      setTestResult({
        success: false,
        message: 'Por favor, insira a URL do Google Apps Script.',
      });
      return;
    }

    if (!trimmed.startsWith('https://script.google.com/macros/s/')) {
      setTestResult({
        success: false,
        message: 'A URL deve começar com "https://script.google.com/macros/s/"',
        details: 'Verifique se copiou a URL do "App da Web" (terminada em /exec).',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetchSheetData(trimmed);
      if (res.error) {
        setTestResult({
          success: false,
          message: 'Não foi possível ler os dados da planilha.',
          details: res.error,
        });
      } else {
        const title = res.state?.sheetTitle || 'Planilha conectada';
        const schoolsCount = res.state?.allSchools?.length || 0;
        const compsCount = Object.keys(res.state?.components || {}).length;

        await onSaveUrl(trimmed);

        setTestResult({
          success: true,
          message: `Conexão estabelecida com sucesso!`,
          details: `Planilha: "${title}" • ${schoolsCount} escolas detectadas • ${compsCount} abas de componentes.`,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'Erro ao conectar à URL.',
        details: err?.message || String(err),
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleRestoreDefault = () => {
    setUrlInput(DEFAULT_SCRIPT_URL);
    setTestResult(null);
  };

  const handleCopyCode = () => {
    const code = getRecommendedAppsScriptCode();
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 3000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#0b1328] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Cabeçalho do Modal */}
        <div className="px-6 py-4 bg-blue-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-900 flex items-center justify-center">
              <Database className="w-4 h-4 text-blue-200" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Atualizar Dados da Planilha</h3>
              <p className="text-xs text-blue-200 font-medium">Suba um arquivo Excel ou conecte ao Google Sheets</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1 rounded-lg text-blue-200 hover:text-white hover:bg-blue-900 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas de Navegação */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#070d19] px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 font-bold text-xs rounded-t-xl transition-colors cursor-pointer border-b-2 ${
              activeTab === 'upload'
                ? 'bg-white dark:bg-[#0b1328] text-blue-950 dark:text-sky-300 border-blue-900 dark:border-sky-500 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-transparent'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Subir Arquivo Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('apps_script')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 font-bold text-xs rounded-t-xl transition-colors cursor-pointer border-b-2 ${
              activeTab === 'apps_script'
                ? 'bg-white dark:bg-[#0b1328] text-blue-950 dark:text-sky-300 border-blue-900 dark:border-sky-500 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-transparent'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Conexão Nuvem (Google Apps Script)</span>
          </button>
        </div>

        {/* Conteúdo do Modal */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm flex-1">
          {/* Status Atual */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#070d19] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status Atual</div>
              <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                {sheetTitle || 'Planilha URE Sul 3'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Última leitura: <strong>{sheetUpdatedAt || 'Sincronizada'}</strong>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              Ativo
            </span>
          </div>

          {activeTab === 'upload' ? (
            /* ABA 1: UPLOAD DE ARQUIVO LOCAL EXCEL (.XLSX) */
            <div className="space-y-4">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? 'border-blue-900 dark:border-sky-400 bg-blue-50/60 dark:bg-blue-950/40 scale-[1.01]'
                    : 'border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-[#070d19]/60 hover:bg-slate-100/70 dark:hover:bg-[#0e1933] hover:border-slate-400'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-900 flex items-center justify-center shadow-xs">
                    {isUploading ? (
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-900" />
                    ) : (
                      <FileSpreadsheet className="w-6 h-6 text-blue-900" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">
                      {isUploading ? 'Processando planilha...' : 'Clique para selecionar ou arraste o arquivo aqui'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Suporta arquivos <strong>.xlsx</strong>, <strong>.xls</strong> e <strong>.csv</strong> com todas as abas oficiais
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isUploading}
                    className="px-4 py-2 rounded-lg bg-blue-900 hover:bg-blue-800 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs pointer-events-none"
                  >
                    Escolher Arquivo do Computador
                  </button>
                </div>
              </div>

              {/* Feedback de Upload */}
              {uploadResult && (
                <div
                  className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
                    uploadResult.success
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                      : 'bg-rose-50 border-rose-300 text-rose-950'
                  }`}
                >
                  {uploadResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                  )}
                  <div className="text-xs space-y-0.5">
                    <div className="font-bold">{uploadResult.message}</div>
                    {uploadResult.details && <div className="opacity-90">{uploadResult.details}</div>}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ABA 2: GOOGLE APPS SCRIPT */
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="scriptUrl" className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    URL do Web App (Google Apps Script)
                  </label>
                  <button
                    type="button"
                    onClick={handleRestoreDefault}
                    className="text-xs text-blue-900 hover:underline font-semibold cursor-pointer"
                  >
                    Restaurar URL Padrão
                  </button>
                </div>
                <input
                  id="scriptUrl"
                  type="text"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-900 text-slate-800 text-xs font-mono transition-colors"
                />
                <p className="text-[11px] text-slate-500">
                  A URL gerada pelo Google Apps Script deve terminar com <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-950 font-bold">/exec</code>.
                </p>
              </div>

              {/* Feedback do Teste */}
              {testResult && (
                <div
                  className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                      : 'bg-rose-50 border-rose-300 text-rose-950'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                  )}
                  <div className="text-xs space-y-0.5">
                    <div className="font-bold">{testResult.message}</div>
                    {testResult.details && <div className="opacity-90">{testResult.details}</div>}
                  </div>
                </div>
              )}

              {/* Botão de Testar e Salvar */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleTestAndSave}
                  disabled={isTesting}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-950 hover:bg-blue-900 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isTesting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Conectando e Validando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Testar e Sincronizar Agora
                    </>
                  )}
                </button>
              </div>

              {/* Instruções do Google Apps Script */}
              <div className="pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCode(!showCode)}
                  className="flex items-center justify-between w-full text-left font-bold text-xs text-blue-950 hover:text-blue-900 cursor-pointer"
                >
                  <span>Como configurar no Google Planilhas (Passo a Passo)</span>
                  <span className="text-[11px] font-semibold text-slate-500">{showCode ? 'Ocultar ▲' : 'Ver instruções ▼'}</span>
                </button>

                {showCode && (
                  <div className="mt-3 space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-700">
                    <ol className="list-decimal pl-4 space-y-1.5 font-medium">
                      <li>Na sua planilha do Google, clique em <strong>Extensões &gt; Apps Script</strong>.</li>
                      <li>Cole o código abaixo substituindo o conteúdo do arquivo <code>Código.gs</code>.</li>
                      <li>Clique no botão azul <strong>Implantar &gt; Gerenciar implantações</strong> (ou <strong>Nova implantação</strong>).</li>
                      <li>Tipo: Escolha <strong>App da Web</strong>.</li>
                      <li>Executar como: <strong>Eu</strong>.</li>
                      <li>
                        Quem pode acessar: <strong className="text-blue-950 bg-blue-100 px-1.5 py-0.5 rounded">Qualquer pessoa</strong>{' '}
                        (essencial para que o painel consiga consultar a planilha sem exigir login do Google).
                      </li>
                      <li>Copie a <strong>URL do Web App</strong> gerada (terminada em <code>/exec</code>) e cole no campo acima!</li>
                    </ol>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-950 text-white font-bold text-xs hover:bg-blue-900 cursor-pointer shadow-2xs"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copiedCode ? 'Código Copiado!' : 'Copiar Código do Apps Script'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
