type UploadProgressProps = {
  progress: number | null;
  label?: string;
};

export function UploadProgress({ progress, label = "Uploading" }: UploadProgressProps) {
  if (progress === null) return null;

  return (
    <div className="space-y-2" role="status" aria-live="polite">
      <div className="flex justify-between text-xs text-warm-gray">
        <span>{label}</span>
        <span>{progress}%</span>
      </div>
      <div className="h-2 overflow-hidden bg-stone/40">
        <div
          className="h-full bg-accent transition-[width] duration-150 ease-out"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        />
      </div>
    </div>
  );
}
