import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FileText, Loader2 } from 'lucide-react';
import { ElevationWorkbench, ResultCard } from '../components/ElevationWorkbench';
import { useToast } from '../components/Toast';
import { previewDocument } from '../api/documentRender';

function DocumentStudioContent() {
  const toast = useToast();
  const [content, setContent] = useState('');
  const [html, setHtml] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      previewDocument({
        title: 'Untitled document',
        content,
        format: 'markdown',
      }),
    onSuccess: (data) => {
      setHtml(data.html);
      toast.success('Preview rendered');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Paste Markdown to preview…" className="input min-h-[200px] font-mono text-xs" />
      <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()} className="btn-primary">
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Render Preview'}
      </button>
      {html && (
        <ResultCard title="HTML Preview">
          <iframe
            title="Document preview"
            srcDoc={html}
            className="w-full min-h-[400px] rounded-lg border border-white/10 bg-white"
            sandbox=""
          />
        </ResultCard>
      )}
    </div>
  );
}

export default function DocumentStudio() {
  return (
    <ElevationWorkbench
      title="Document Studio"
      subtitle="HTML and Markdown preview with PDF export"
      icon={<FileText className="h-7 w-7 text-accent" />}
      requireProject={false}
    >
      {() => <DocumentStudioContent />}
    </ElevationWorkbench>
  );
}
