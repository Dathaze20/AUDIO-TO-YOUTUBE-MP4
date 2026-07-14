import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FileUploader from './FileUploader';

describe('FileUploader', () => {
  it('shows the label and hint when no file is selected', () => {
    render(
      <FileUploader
        label="Cover Image"
        accept="image/png"
        hint="PNG only"
        icon={<span />}
        onFileSelect={() => {}}
      />
    );
    expect(screen.getByText('Cover Image')).toBeInTheDocument();
    expect(screen.getByText('PNG only')).toBeInTheDocument();
  });

  it('shows the selected file name instead of the label once a file is chosen', () => {
    render(
      <FileUploader
        label="Cover Image"
        accept="image/png"
        hint="PNG only"
        icon={<span />}
        onFileSelect={() => {}}
        selectedFileName="cover.png"
      />
    );
    expect(screen.getByText('cover.png')).toBeInTheDocument();
    expect(screen.getByText('Tap to change')).toBeInTheDocument();
  });

  it('calls onFileSelect with the chosen file', () => {
    const onFileSelect = vi.fn();
    render(
      <FileUploader
        label="Cover Image"
        accept="image/png"
        hint="PNG only"
        icon={<span />}
        onFileSelect={onFileSelect}
      />
    );
    const input = screen.getByLabelText(/Cover Image/i).querySelector('input') as HTMLInputElement;
    const file = new File(['data'], 'cover.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFileSelect).toHaveBeenCalledWith(file);
  });
});
