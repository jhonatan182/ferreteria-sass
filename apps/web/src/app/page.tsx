import { Button } from '@/components/ui/button';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Ferretería SaaS</h1>
        <p className="text-muted-foreground">
          Base técnica del monorepo. Aún sin módulos de dominio.
        </p>
      </div>

      <p className="text-sm text-muted-foreground">
        API configurada en <code className="font-mono">{API_URL}</code>
      </p>

      <Button asChild>
        <a href={`${API_URL}/health`} target="_blank" rel="noopener noreferrer">
          Ver estado de la API
        </a>
      </Button>
    </main>
  );
}
