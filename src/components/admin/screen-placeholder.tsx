import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Phase 1 stand-in for screens that arrive in later phases. Keeps navigation
 * working (no 404s) and states clearly what will live here.
 */
export function ScreenPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">{title}</h1>
      </header>
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
