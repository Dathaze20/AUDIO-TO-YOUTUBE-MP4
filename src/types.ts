
export interface FileState {
  file: File | Blob | null;
  previewUrl: string | null;
  name: string;
}

export enum RenderStatus {
  IDLE = 'IDLE',
  GENERATING_IMAGE = 'GENERATING_IMAGE',
  GENERATING_AUDIO = 'GENERATING_AUDIO',
  PREPARING = 'PREPARING',
  RENDERING = 'RENDERING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface RenderingProgress {
  status: RenderStatus;
  progress: number;
  message: string;
}
