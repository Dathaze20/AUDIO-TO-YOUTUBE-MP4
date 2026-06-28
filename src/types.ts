export interface FileState {
  file: File | null;
  previewUrl: string | null;
  name: string;
}

export enum ConversionStatus {
  IDLE = 'IDLE',
  CONVERTING = 'CONVERTING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface ConversionProgress {
  status: ConversionStatus;
  progress: number;
  message: string;
}
