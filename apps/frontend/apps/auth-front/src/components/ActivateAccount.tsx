import { Button, HeroParticles, HeroWaves, Icon, Router, toast } from "@nextticket-frontend/commons";
import { FormEvent, useState } from "react";
import { InputField, authCardClassName } from "./AuthCardUI";
import { activateAccount, resendActivation, toFriendlyAuthError } from "../api";

const MIN_PASSWORD_LENGTH = 8;

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

function ResendActivation({ token }: { token: string | null }) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResend = async (e: FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await resendActivation(email);
      setSent(true);
    } catch (err) {
      toast.danger(toFriendlyAuthError(err, "No se pudo reenviar el correo de activación."));
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <p className="text-success text-xs text-center">
        Si el correo corresponde a una cuenta pendiente de activación, se envió un nuevo enlace.
      </p>
    );
  }

  return (
    <form onSubmit={handleResend} className="space-y-3">
      <p className="text-muted text-xs text-center">
        {token
          ? "El enlace de activación ya no es válido. Escribe tu correo para recibir uno nuevo."
          : "Escribe tu correo para recibir un nuevo enlace de activación."}
      </p>
      <InputField
        id="resend-email"
        label="Correo electrónico"
        type="email"
        placeholder="nombre@ejemplo.com"
        value={email}
        onChange={setEmail}
        icon={<Icon.Mail className="w-4 h-4" />}
      />
      <Button type="submit" fullWidth isDisabled={sending}>
        {sending ? "Enviando..." : "Reenviar enlace de activación"}
      </Button>
    </form>
  );
}

export function ActivateAccount() {
  const navigate = Router.useNavigate();
  const [searchParams] = Router.useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [activated, setActivated] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLinkError(null);

    if (!password || !confirmPassword) {
      toast.danger("La contraseña y su confirmación son obligatorias.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.danger(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirmPassword) {
      toast.danger("Las contraseñas no coinciden.");
      return;
    }
    if (!token) {
      const message = "El enlace de activación no incluye un token válido.";
      toast.danger(message);
      setLinkError(message);
      return;
    }

    setLoading(true);
    try {
      await activateAccount(token, password, confirmPassword);
      setActivated(true);
    } catch (err) {
      const message = toFriendlyAuthError(err, "No se pudo activar la cuenta.");
      toast.danger(message);
      // Solo se manda a la pantalla de "pedir enlace nuevo" cuando el token en
      // sí es el problema (inválido/expirado): el backend siempre usa
      // BadRequestException para eso, así que se detecta por contenido del
      // mensaje en vez de status — ambas rutas devuelven 400.
      if (message.toLowerCase().includes("enlace")) {
        setLinkError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full min-h-screen flex items-center justify-center px-4 py-10 bg-background overflow-hidden">
      <HeroWaves />
      <HeroParticles />

      <div className={`relative z-10 w-full max-w-88 rounded-[24px] p-5 ${authCardClassName}`}>
        {activated ? (
          <div className="flex flex-col items-center text-center gap-3 py-4">
            <div className="flex size-12 items-center justify-center rounded-full bg-success/10">
              <Icon.CheckCircle2 className="size-6 text-success" />
            </div>
            <h1 className="text-foreground font-bold text-lg tracking-tight">¡Cuenta activada!</h1>
            <p className="text-muted text-xs">Tu cuenta ha sido activada correctamente. Ya puedes iniciar sesión.</p>
            <Button fullWidth onPress={() => navigate("/sign-in")}>
              <Icon.LogIn />
              Ir a iniciar sesión
            </Button>
          </div>
        ) : (
          <>
            <BackToLogin />
            <div className="text-center mb-4 pb-4 border-b border-border">
              <h1 className="text-foreground font-bold text-lg tracking-tight mb-1">Activar cuenta</h1>
              <p className="text-muted text-xs">Establece tu contraseña para activar tu cuenta de NextTicket</p>
            </div>

            {linkError ? (
              <ResendActivation token={token} />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <InputField
                  id="activate-password"
                  label="Nueva contraseña"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={setPassword}
                  icon={<Icon.Lock className="w-4 h-4" />}
                  rightSlot={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="text-muted hover:text-foreground transition-colors"
                    >
                      {showPassword ? <Icon.Eye className="w-4 h-4" /> : <Icon.EyeOff className="w-4 h-4" />}
                    </button>
                  }
                />
                <InputField
                  id="activate-confirm-password"
                  label="Confirmar contraseña"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  icon={<Icon.Lock className="w-4 h-4" />}
                  rightSlot={
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="text-muted hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? <Icon.Eye className="w-4 h-4" /> : <Icon.EyeOff className="w-4 h-4" />}
                    </button>
                  }
                />
                <Button type="submit" fullWidth isDisabled={loading}>
                  {loading ? "Activando..." : "Activar cuenta"}
                </Button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
