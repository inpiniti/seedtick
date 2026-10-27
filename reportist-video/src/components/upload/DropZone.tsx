// components/upload/DropZone.tsx - 다중 영상 드래그 앤 드롭 업로드 영역

import React, { useState, useRef } from 'react';
import { UploadCloud, Plus } from 'lucide-react';

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({ onFilesSelected, disabled = false }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const videoFiles = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(file.name)
      );
      if (videoFiles.length > 0) {
        onFilesSelected(videoFiles);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onFilesSelected(files);
      e.target.value = '';
    }
  };

  return (
    <div
      className={`dropzone-container ${isDragOver ? 'is-dragover' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
        disabled={disabled}
      />

      <div className="dropzone-icon-box">
        <UploadCloud className="w-8 h-8" />
      </div>

      <div className="dropzone-title">
        여러 영상을 여기에 끌어다 놓아주세요
      </div>
      <div className="dropzone-subtext">
        MP4, WebM, MOV 등 모든 일반 동영상 형식을 지원해요 · 영상은 서버로 전송되지 않고 브라우저에서 안전하게 처리돼요
      </div>

      <button
        type="button"
        className="dropzone-btn"
        onClick={(e) => {
          e.stopPropagation();
          fileInputRef.current?.click();
        }}
        disabled={disabled}
      >
        <Plus className="w-4 h-4 text-[#2563eb]" />
        내 컴퓨터에서 영상 선택하기
      </button>
    </div>
  );
};
