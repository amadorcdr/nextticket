import { Button, HeroParticles, HeroWaves, Icon, Router } from "@nextticket-frontend/commons";
import { FormEvent, useState } from "react";
import { InputField, authCardClassName } from "./AuthCardUI";
import { discardPasswordReset, resetPassword } from "../api";

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

function RequestNewLink() {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-4">
      <div className="flex size-12 items-center justify-center rounded-full bg-danger/10">
        <Icon.Link2Off className="size-6 text-danger" />
      </div>
      <p className="text-muted text-xs">
        Puedes solicitar un enlace nuevo desde{" "}
        <Router.Link to="/forgot-password" className="text-foreground font-semibold hover:opacity-70">
          "¿Olvidaste tu contraseña?"
        </Router.Link>
        .
      </p>
    </div>
  );
}

export function ResetPassword() {
  const navigate = Router.useNavigate();
  const [searchParams] = Router.useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [updated, setUpdated] = useState(false);
  const [discarded, setDiscarded] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFieldError(null);
    setLinkError(null);

    if (!password || !confirmPassword) {
      setFieldError("La contraseña y su confirmación son obligatorias.");
      return;
    }
    if (password !== confirmPassword) {
      setFieldError("Las contraseñas no coinciden.");
      return;
    }
    if (!token) {
      setLinkError("El enlace de recuperación no es válido.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password, confirmPassword);
      setUpdated(true);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "No se pudo restablecer la contraseña.");
    } finally {
      setLoading(false);
    }
  };

  const handleDiscard = async () => {
    if (!token) return;
    setDiscarding(true);
    try {
      await discardPasswordReset(token);
    } finally {
      setDiscarding(false);
      setDiscarded(true);
    }
  };

  return (
    <div className="relative w-full min-h-screen flex items-center justify-center px-4 py-10 bg-background overflow-hidden">
      <HeroWaves />
      <HeroParticles />

      <div className={`relative z-10 w-full max-w-88 rounded-[24px] p-5 ${authCardClassName}`}>
        {updated ? (
          <div className="flex flex-col items-center text-center gap-3 py-4">
            <div className="flex size-12 items-center justify-center rounded-full bg-success/10">
              <Icon.CheckCircle2 className="size-6 text-success" />
            </div>
            <h1 className="text-foreground font-bold text-lg tracking-tight">¡Listo!</h1>
            <p className="text-muted text-xs">Tu contraseña se actualizó correctamente.</p>
            <Button fullWidth onPress={() => navigate("/sign-in")}>
              <Icon.LogIn />
              Ir al inicio de sesión
            </Button>
          </div>
        ) : discarded ? (
          <div className="flex flex-col items-center text-center gap-3 py-4">
            <div className="flex size-12 items-center justify-center rounded-full bg-default">
              <Icon.ShieldCheck className="size-6 text-foreground" />
            </div>
            <h1 className="text-foreground font-bold text-lg tracking-tight">Solicitud descartada</h1>
            <p className="text-muted text-xs">
              El enlace ya no es válido y tu contraseña no cambió. Si tú no pediste este cambio, no tienes que hacer
              nada más.
            </p>
            <Button fullWidth onPress={() => navigate("/sign-in")}>
              <Icon.LogIn />
              Ir al inicio de sesión
            </Button>
          </div>
        ) : (
          <>
            <BackToLogin />
            <div className="text-center mb-4 pb-4 border-b border-border">
              <h1 className="text-foreground font-bold text-lg tracking-tight mb-1">Restablecer contraseña</h1>
              <p className="text-muted text-xs">Elige una nueva contraseña para tu cuenta de NextTicket.</p>
            </div>

            {linkError ? (
              <RequestNewLink />
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <InputField
                    id="reset-password"
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
                    id="reset-confirm-password"
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
                  {fieldError && <p className="text-danger text-xs">{fieldError}</p>}
                  <Button type="submit" fullWidth isDisabled={loading}>
                    {loading ? "Restableciendo..." : "Restablecer contraseña"}
                  </Button>
                </form>

                <div className="mt-3 pt-3 text-center border-t border-border">
                  <p className="text-muted text-[11px]">
                    ¿No solicitaste este cambio?{" "}
                    <button
                      type="button"
                      onClick={handleDiscard}
                      disabled={discarding}
                      className="text-foreground font-semibold hover:opacity-70 transition-opacity"
                    >
                      {discarding ? "Cancelando..." : "Cancelar solicitud"}
                    </button>
                  </p>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
