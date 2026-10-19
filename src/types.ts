export interface TeacherGeneral {
  escola: string;
  nome: string;
  cpf?: string;
  cargo?: string;
  observacao?: string;
}

export interface TeacherTraining {
  cpf?: string;
  docente: string;
  cargo?: string;
  area?: string;
  formacoesPrevistas: number;
  formacoesConcluidas: number;
  concluidoStatus: string;
  escola: string;
  escolas?: string[];
  percentual: number;
  isCompleted: boolean;
  faltam: number;
  observacao?: string;
  isSimilarMatch?: boolean;
  matchedSchoolTeacherName?: string;
  isNotFoundInBi?: boolean;
}

export interface ComponentData {
  name: string;
  records: TeacherTraining[];
  totalPrevistas: number;
  totalConcluidas: number;
  percentualGeral: number;
  totalDocentes: number;
  totalConcluidos: number;
  totalPendentes: number;
}

export interface AttendedPendingEvaluation {
  docente: string;
  cpf?: string;
  cargo?: string;
  escola: string;
  componente: string;
  area?: string;
  formacoesPrevistas: number;
  formacoesConcluidas: number;
  faltam: number;
  observacao?: string;
  isSimilarMatch?: boolean;
  originalFormadosName?: string;
  matchedSchoolTeacherName?: string;
  isNotFoundInBi?: boolean;
}

export interface SchoolAggregate {
  escola: string;
  totalDocentes: number;
  concluidos: number;
  pendentes: number;
  previstas: number;
  concluidas: number;
  percentual: number;
}

export interface SheetState {
  sheetTitle: string;
  sheetUpdatedAt: string | null;
  profsGeral: TeacherGeneral[];
  allSchools: string[];
  components: Record<string, ComponentData>;
  componentNames: string[];
  attendedWithoutSedEvaluation: AttendedPendingEvaluation[];
  totalFormadosPresencial: number;
  lastFetchedAt: Date | null;
  isLoading: boolean;
  error: string | null;
  isMockData: boolean;
  rawUrl: string;
}

