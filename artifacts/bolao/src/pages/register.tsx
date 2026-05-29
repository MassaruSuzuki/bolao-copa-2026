import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { LoginBackground } from "@/components/LoginBackground";
import { useEffect } from "react";
import { Clock, CheckCircle } from "lucide-react";

const schema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const { user } = useAuth();
  const [, setLocation] = useState<string | null>(null);
  const { toast } = useToast();
  const registerMutation = useRegister();
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    if (user) {
      window.location.href = "/dashboard";
    }
  }, [user]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = (data: FormData) => {
    registerMutation.mutate(
      { data },
      {
        onSuccess: () => {
          setRegistered(true);
        },
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : "Erro ao criar conta";
          toast({ title: "Erro no cadastro", description: message, variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <LoginBackground />

      <div className="relative z-10 w-full max-w-sm px-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <div
              className="absolute inset-0 rounded-full blur-2xl opacity-40"
              style={{ background: "radial-gradient(circle, rgba(201,162,39,0.7) 0%, transparent 70%)", transform: "scale(1.4)" }}
            />
            <img
              src="/logo-copa.png"
              alt="FIFA World Cup"
              className="relative w-24 h-auto"
              style={{ filter: "drop-shadow(0 0 20px rgba(201,162,39,0.5))" }}
            />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white" style={{ textShadow: "0 0 24px rgba(201,162,39,0.5), 0 2px 4px rgba(0,0,0,0.8)" }}>
            Bolão da Copa
          </h1>
          <p className="text-sm mt-1" style={{ color: "rgba(201,162,39,0.8)" }}>
            {registered ? "Cadastro realizado" : "Crie sua conta e participe"}
          </p>
        </div>

        {registered ? (
          /* ── Pending approval screen ── */
          <div
            className="rounded-2xl p-8 border text-center"
            style={{
              background: "rgba(10,11,15,0.80)",
              backdropFilter: "blur(24px)",
              borderColor: "rgba(201,162,39,0.18)",
              boxShadow: "0 0 0 1px rgba(201,162,39,0.08), 0 24px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(201,162,39,0.12)",
            }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "rgba(201,162,39,0.12)", border: "1px solid rgba(201,162,39,0.25)" }}
            >
              <Clock className="w-8 h-8" style={{ color: "hsl(43,74%,52%)" }} />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Cadastro recebido!</h2>
            <p className="text-sm text-white/60 leading-relaxed mb-6">
              Seu cadastro foi enviado para aprovação.{" "}
              <strong className="text-white/80">Aguarde o administrador liberar seu acesso</strong>{" "}
              antes de fazer login.
            </p>
            <div
              className="rounded-xl px-4 py-3 mb-6 text-left"
              style={{ background: "rgba(201,162,39,0.06)", border: "1px solid rgba(201,162,39,0.12)" }}
            >
              <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(201,162,39,0.8)" }}>
                <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Você receberá acesso assim que o admin aprovar</span>
              </div>
            </div>
            <Link href="/login">
              <Button
                variant="outline"
                className="w-full border-white/10 text-white/60 hover:text-white hover:border-white/20"
              >
                Voltar ao login
              </Button>
            </Link>
          </div>
        ) : (
          /* ── Register form ── */
          <div
            className="rounded-2xl p-6 border"
            style={{
              background: "rgba(10,11,15,0.80)",
              backdropFilter: "blur(24px)",
              borderColor: "rgba(201,162,39,0.18)",
              boxShadow: "0 0 0 1px rgba(201,162,39,0.08), 0 24px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(201,162,39,0.12)",
            }}
          >
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/70 text-xs font-semibold uppercase tracking-widest">Nome</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Seu nome"
                          className="bg-white/5 border-white/10 focus:border-primary/60 text-white placeholder:text-white/25 h-11"
                          {...field}
                          data-testid="input-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/70 text-xs font-semibold uppercase tracking-widest">Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="seu@email.com"
                          className="bg-white/5 border-white/10 focus:border-primary/60 text-white placeholder:text-white/25 h-11"
                          {...field}
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/70 text-xs font-semibold uppercase tracking-widest">Senha</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Mínimo 6 caracteres"
                          className="bg-white/5 border-white/10 focus:border-primary/60 text-white placeholder:text-white/25 h-11"
                          {...field}
                          data-testid="input-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full h-11 font-bold text-sm tracking-wide mt-2"
                  disabled={registerMutation.isPending}
                  style={{
                    background: registerMutation.isPending
                      ? "rgba(201,162,39,0.5)"
                      : "linear-gradient(135deg, hsl(43,74%,52%) 0%, hsl(38,80%,44%) 100%)",
                    boxShadow: registerMutation.isPending ? "none" : "0 4px 16px rgba(201,162,39,0.35)",
                    color: "#1a1200",
                  }}
                  data-testid="button-submit"
                >
                  {registerMutation.isPending ? "Criando..." : "Criar conta"}
                </Button>
              </form>
            </Form>

            <div className="mt-5 pt-5 border-t border-white/8 text-center">
              <p className="text-sm text-white/40">
                Já tem conta?{" "}
                <Link href="/login" className="font-semibold hover:underline" style={{ color: "rgba(201,162,39,0.9)" }}>
                  Entrar
                </Link>
              </p>
            </div>
          </div>
        )}

        <p className="text-center text-xs mt-6" style={{ color: "rgba(255,255,255,0.2)" }}>
          © 2026 Bolão da Copa · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
