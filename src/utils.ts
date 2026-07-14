export function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function validateFile(file: File, acceptedTypes: string[], label: string): string | null {
  if (acceptedTypes.length > 0 && !acceptedTypes.some(t => file.type.startsWith(t.replace('/*', '')))) {
    return `${label}: "${file.type || file.name}" is not a supported format.`;
  }
  if (file.size > 500 * 1024 * 1024) {
    return `${label} is too large (${(file.size / 1024 / 1024).toFixed(0)} MB). Max 500 MB.`;
  }
  return null;
}
