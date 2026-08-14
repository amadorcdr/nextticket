import { Button, HeroParticles, HeroWaves, Icon, Router } from "@nextticket-frontend/commons";
import { FormEvent, useState } from "react";
import { InputField, authCardClassName } from "./AuthCardUI";
import { forgotPassword } from "../api";

function BackToLogin() {
  return (
    <div className="flex mb-3">
      <Router.Link
        to="/sign-in"
        className="inline-flex items-center gap-1 text-muted hover:text-foreground text-xs transition-colors"
      >
        <Icon.ChevronLeft className="w-3.5 h-3.5" />
        Inicio de sesión
      </Router.Link>
    </div>
  );
}

export function ForgotPassword() {
  const navigate = Router.useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // La respuesta es siempre el mismo mensaje genérico, exista o no la
      // cuenta: por eso el estado "enviado" no depende del resultado.
      await forgotPassword(email);
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <div className="relative w-full min-h-screen flex items-center justify-center px-4 py-10 bg-background overflow-hidden">
      <HeroWaves />
      <HeroParticles />

      <div className={`relative z-10 w-full max-w-88 rounded-[24px] p-5 ${authCardClassName}`}>
        {sent ? (
          <div className="flex flex-col items-center text-center gap-3 py-4">
            <div className="flex size-12 items-center justify-center rounded-full bg-success/10">
              <Icon.MailCheck className="size-6 text-success" />
            </div>
            <h1 className="text-foreground font-bold text-lg tracking-tight">Revisa tu correo</h1>
            <p className="text-muted text-xs">
              Si existe una cuenta asociada a <span className="text-foreground font-medium">{email}</span>, recibirás
              un enlace para restablecer tu contraseña.
            </p>
            <Button fullWidth variant="secondary" onPress={() => navigate("/sign-in")}>
              <Icon.LogIn />
              Volver al inicio de sesión
            </Button>
          </div>
        ) : (
          <>
            <BackToLogin />
            <div className="text-center mb-4 pb-4 border-b border-border">
              <h1 className="text-foreground font-bold text-lg tracking-tight mb-1">Recuperar contraseña</h1>
              <p className="text-muted text-xs">Ingresa el correo asociado a tu cuenta.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <InputField
                id="forgot-email"
                label="Correo electrónico"
                type="email"
                placeholder="nombre@ejemplo.com"
                value={email}
                onChange={setEmail}
                icon={<Icon.Mail className="w-4 h-4" />}
              />
              <Button type="submit" fullWidth isDisabled={loading}>
                {loading ? "Enviando..." : "Enviar enlace de recuperación"}
              </Button>
            </form>

            <div className="mt-3 pt-3 text-center border-t border-border">
              <Router.Link
                to="/sign-in"
                className="text-foreground text-xs font-semibold hover:opacity-70 transition-opacity"
              >
                Volver al inicio de sesión
              </Router.Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
