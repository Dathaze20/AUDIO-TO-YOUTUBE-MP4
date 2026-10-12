/**
 * Tests for the stopReasonRef guard introduced for phone-call recovery.
 *
 * The conversion pipeline relies on browser APIs (Canvas, AudioContext,
 * MediaRecorder) that jsdom doesn't fully support. Tests here cover:
 *   - UI transitions that don't require the full pipeline
 *   - The new onstop guard by capturing the recorder and calling its callback
 *     directly after getting the app into CONVERTING state
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import App from './App';

// ─── recorder registry (module-level so beforeEach doesn't overwrite it) ──────

let capturedRecorder: StubMediaRecorder | null = null;

class StubMediaRecorder {
  state: RecordingState = 'inactive';
  mimeType: string;
  ondataavailable: ((e: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(_stream: MediaStream, opts?: MediaRecorderOptions) {
    this.mimeType = opts?.mimeType ?? 'video/webm';
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    capturedRecorder = this;
  }

  start() { this.state = 'recording'; }
  pause() { this.state = 'paused'; }
  resume() { this.state = 'recording'; }

  /** Simulate a force-stop: change state to inactive and fire onstop WITHOUT
   * going through the app's stopRecording() → so stopReasonRef stays null. */
  forceStop() {
    this.state = 'inactive';
    if (this.ondataavailable) {
      const e = Object.assign(new Event('dataavailable'), {
        data: new Blob([], { type: this.mimeType }),
      }) as BlobEvent;
      this.ondataavailable(e);
    }
    if (this.onstop) this.onstop();
  }

  /** Normal stop — called by the app's stopRecording(). */
  stop() { this.forceStop(); }

  static isTypeSupported(t: string) {
    return t === 'video/webm;codecs=vp8,opus' || t === 'video/webm';
  }
}

// ─── global stub setup ────────────────────────────────────────────────────────

function setupEnv() {
  vi.stubGlobal('MediaRecorder', StubMediaRecorder);

  vi.stubGlobal('AudioContext', class {
    state = 'running' as AudioContextState;
    destination = {} as AudioDestinationNode;
    createMediaStreamDestination() {
      return { stream: { getAudioTracks: () => [{}] } } as unknown as MediaStreamAudioDestinationNode;
    }
    createMediaElementSource() {
      return { connect: vi.fn(), disconnect: vi.fn() } as unknown as MediaElementAudioSourceNode;
    }
    async resume() { this.state = 'running'; }
  });

  // Canvas 2D stub
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    fillStyle: '',
    fillRect: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  HTMLCanvasElement.prototype.captureStream = vi.fn().mockReturnValue({
    getVideoTracks: () => [{}],
  } as unknown as MediaStream);

  // HTMLAudioElement
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  HTMLMediaElement.prototype.pause = vi.fn();
  Object.defineProperty(HTMLMediaElement.prototype, 'duration', { get: () => 60, configurable: true });
  Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { get: () => 4, configurable: true });
  Object.defineProperty(HTMLMediaElement.prototype, 'ended', { get: () => false, configurable: true });

  // Image: defer onload so img.onload is assigned before it fires
  vi.stubGlobal('Image', class {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    width = 1280;
    height = 720;
    set src(_v: string) {
      // Use a microtask so the caller can assign img.onload BEFORE we fire it
      Promise.resolve().then(() => { if (this.onload) this.onload(); });
    }
  });

  // MediaStream: jsdom doesn't provide this
  vi.stubGlobal('MediaStream', class {
    private tracks: MediaStreamTrack[];
    constructor(tracks: MediaStreamTrack[] = []) { this.tracks = tracks; }
    getVideoTracks() { return this.tracks.filter(() => true); }
    getAudioTracks() { return this.tracks.filter(() => true); }
  });

  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:fake'),
    revokeObjectURL: vi.fn(),
  });

  vi.stubGlobal('requestAnimationFrame', vi.fn());
  vi.stubGlobal('cancelAnimationFrame', vi.fn());

  Object.defineProperty(navigator, 'wakeLock', {
    value: { request: vi.fn().mockResolvedValue({ release: vi.fn() }) },
    configurable: true,
  });
  Object.defineProperty(navigator, 'vibrate', {
    value: vi.fn(),
    configurable: true,
  });

  vi.spyOn(console, 'error').mockImplementation(() => {});
}

// ─── test helpers ─────────────────────────────────────────────────────────────

function makeImageFile() {
  return new File(['x'], 'cover.png', { type: 'image/png' });
}
function makeAudioFile() {
  return new File(['x'], 'track.mp3', { type: 'audio/mpeg' });
}

async function selectBothFiles() {
  const imageInput = document.querySelector('input[accept*="image"]') as HTMLInputElement;
  const audioInput = document.querySelector('input[accept*="audio"]') as HTMLInputElement;
  await act(async () => {
    fireEvent.change(imageInput, { target: { files: [makeImageFile()] } });
    fireEvent.change(audioInput, { target: { files: [makeAudioFile()] } });
  });
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('App — idle and file selection', () => {
  beforeEach(() => { setupEnv(); capturedRecorder = null; });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('renders the idle screen', () => {
    render(<App />);
    expect(screen.getByText('Create Video')).toBeInTheDocument();
  });

  it('Create Video button is disabled until both files are selected', async () => {
    render(<App />);
    const btn = screen.getByRole('button', { name: /create video/i });
    expect(btn).toBeDisabled();

    const imageInput = document.querySelector('input[accept*="image"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(imageInput, { target: { files: [makeImageFile()] } });
    });
    expect(btn).toBeDisabled();

    const audioInput = document.querySelector('input[accept*="audio"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(audioInput, { target: { files: [makeAudioFile()] } });
    });
    expect(btn).not.toBeDisabled();
  });

  it('shows a validation error for an unsupported image type', async () => {
    render(<App />);
    const imageInput = document.querySelector('input[accept*="image"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(imageInput, { target: { files: [new File(['x'], 'clip.gif', { type: 'image/gif' })] } });
    });
    expect(screen.getByText(/not a supported format/i)).toBeInTheDocument();
  });
});

describe('App — phone-call recovery (stopReasonRef guard)', () => {
  beforeEach(() => { setupEnv(); capturedRecorder = null; });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  async function startConversionAndGetRecorder() {
    render(<App />);
    await selectBothFiles();

    const btn = screen.getByRole('button', { name: /create video/i });
    await act(async () => { fireEvent.click(btn); });

    // Wait for startConversion to progress to MediaRecorder creation
    await waitFor(() => expect(capturedRecorder).not.toBeNull(), { timeout: 3000 });
    return capturedRecorder!;
  }

  it('enters CONVERTING state immediately after Create Video is clicked', async () => {
    render(<App />);
    await selectBothFiles();

    const btn = screen.getByRole('button', { name: /create video/i });
    await act(async () => { fireEvent.click(btn); });

    // CONVERTING state sets "Preparing..." before any async work
    await waitFor(() => expect(screen.getByText(/converting\.\.\./i)).toBeInTheDocument());
  });

  it('shows error (not "Video Saved") when recorder is force-stopped unexpectedly', async () => {
    const recorder = await startConversionAndGetRecorder();

    // Force-stop the recorder without going through the app's stopRecording()
    // (simulates browser killing the recorder during a phone call).
    // stopReasonRef.current is null → onstop should show error, not download.
    await act(async () => { recorder.forceStop(); });

    await waitFor(() =>
      expect(screen.queryByText(/recording was cut off/i)).toBeInTheDocument()
    );
    expect(screen.queryByText(/video saved/i)).not.toBeInTheDocument();
  });

  it('does NOT trigger auto-download when the recorder is force-stopped', async () => {
    const recorder = await startConversionAndGetRecorder();

    // Clear URL mock counts accumulated during file selection and startConversion setup
    (URL.createObjectURL as ReturnType<typeof vi.fn>).mockClear();

    await act(async () => { recorder.forceStop(); });

    // onstop with stopReason=null must not call URL.createObjectURL (no Blob URL for download)
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('Cancel during conversion returns to idle without downloading', async () => {
    render(<App />);
    await selectBothFiles();

    const btn = screen.getByRole('button', { name: /create video/i });
    await act(async () => { fireEvent.click(btn); });

    await waitFor(() => screen.getByRole('button', { name: /cancel/i }));
    (URL.createObjectURL as ReturnType<typeof vi.fn>).mockClear();

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    await act(async () => { fireEvent.click(cancelBtn); });

    await waitFor(() => expect(screen.getByRole('button', { name: /create video/i })).toBeInTheDocument());
    // No download on cancel
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
