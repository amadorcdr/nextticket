import {
  Button,
  Icon,
  Router,
  toast,
  Surface,
  Form,
  TextField,
  Label,
  Input,
  FieldError,
  InputGroup,
  Link,
} from "@nextticket-frontend/commons";
import { FormEvent, useState } from "react";
import { discardPasswordReset, resetPassword, toFriendlyAuthError } from "../api";

function RequestNewLink() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center gap-3">
        <h1>Enlace inválido</h1>
        <div className="flex shrink-0 size-16 items-center justify-center rounded-full bg-danger/10 text-danger mb-2">
          <Icon.Link2Off className="size-8!" />
        </div>
      </div>
      <p className="text-muted">
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
  const [linkError, setLinkError] = useState<string | null>(null);
  const [updated, setUpdated] = useState(false);
  const [discarded, setDiscarded] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLinkError(null);

    if (!password || !confirmPassword) {
      toast.danger("La contraseña y su confirmación son obligatorias.");
      return;
    }
    if (password !== confirmPassword) {
      toast.danger("Las contraseñas no coinciden.");
      return;
    }
    if (!token) {
      const message = "El enlace de recuperación no es válido.";
      toast.danger(message);
      setLinkError(message);
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password, confirmPassword);
      setUpdated(true);
    } catch (err) {
      const message = toFriendlyAuthError(err, "No se pudo restablecer la contraseña.");
      toast.danger(message);
      // Mismo criterio que en ActivateAccount: solo se manda a "pide un
      // enlace nuevo" cuando el problema es el token, no la validación del
      // formulario — ambos casos son 400, así que se distingue por mensaje.
      if (message.toLowerCase().includes("enlace")) {
        setLinkError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDiscard = async () => {
    if (!token) return;
    setDiscarding(true);
    try {
      await discardPasswordReset(token);
      setDiscarded(true);
    } catch (err) {
      toast.danger(toFriendlyAuthError(err, "No se pudo descartar la solicitud."));
    } finally {
      setDiscarding(false);
    }
  };

  return (
    <Surface className="flex flex-col gap-6 bg-background shadow-overlay rounded-[10px] w-full max-w-[400px] max-h-full overflow-y-auto p-10 pointer-events-auto">
      {updated ? (
        <>
          <div className="flex justify-between gap-4">
            <Router.Link to="/" className="link gap-1">
              <Link.Icon>
                <Icon.ChevronLeft />
              </Link.Icon>
              Inicio
            </Router.Link>
          </div>
          <div className="flex justify-between items-center gap-3">
            <h1>¡Listo!</h1>
            <div className="flex shrink-0 size-16 items-center justify-center rounded-full bg-success/10 text-success mb-2">
              <Icon.CheckCircle2 className="size-8!" />
            </div>
          </div>

          <p className="text-muted">
            Tu contraseña se actualizó correctamente.
          </p>

          <Button fullWidth onPress={() => navigate("/sign-in")}>
            <Icon.LogIn />
            Ir al inicio de sesión
          </Button>
        </>
      ) : discarded ? (
        <>
          <div className="flex justify-between gap-4">
            <Router.Link to="/" className="link gap-1">
              <Link.Icon>
                <Icon.ChevronLeft />
              </Link.Icon>
              Inicio
            </Router.Link>
          </div>
          <div className="flex justify-between items-center gap-3">
            <h1>Solicitud descartada</h1>
            <div className="flex shrink-0 size-16 items-center justify-center rounded-full bg-default text-foreground mb-2">
              <Icon.ShieldCheck className="size-8!" />
            </div>
          </div>

          <p className="text-muted">
            El enlace ya no es válido y tu contraseña no cambió. Si tú no pediste este cambio, no tienes que hacer nada más.
          </p>

          <Button fullWidth onPress={() => navigate("/sign-in")}>
            <Icon.LogIn />
            Ir al inicio de sesión
          </Button>
        </>
      ) : (
        <>
          <div className="flex justify-between gap-4">
            <Router.Link to="/sign-in" className="link gap-1">
              <Link.Icon>
                <Icon.ChevronLeft />
              </Link.Icon>
              Inicio de sesión
            </Router.Link>
          </div>
          
          {linkError ? (
            <RequestNewLink />
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <h1>Restablecer contraseña</h1>
                <p className="text-muted">Elige una nueva contraseña para tu cuenta de NextTicket.</p>
              </div>

              <Form className="flex flex-col gap-4 flex-1" onSubmit={handleSubmit}>
                <TextField
                  isRequired
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e: any) => setPassword(e.target ? e.target.value : e)}
                >
                  <Label>Nueva contraseña</Label>
                  <InputGroup>
                    <InputGroup.Input placeholder="••••••••" />
                    <InputGroup.Suffix>
                      <Button type="button" isIconOnly size="sm" variant="ghost" onPress={() => setShowPassword(!showPassword)}>
                        {showPassword ? <Icon.EyeOff /> : <Icon.Eye />}
                      </Button>
                    </InputGroup.Suffix>
                  </InputGroup>
                  <FieldError />
                </TextField>

                <TextField
                  isRequired
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e: any) => setConfirmPassword(e.target ? e.target.value : e)}
                  validate={(value) => {
                    if (value !== password) return "Las contraseñas no coinciden.";
                    return null;
                  }}
                >
                  <Label>Confirmar contraseña</Label>
                  <InputGroup>
                    <InputGroup.Input placeholder="••••••••" />
                    <InputGroup.Suffix>
                      <Button type="button" isIconOnly size="sm" variant="ghost" onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                        {showConfirmPassword ? <Icon.EyeOff /> : <Icon.Eye />}
                      </Button>
                    </InputGroup.Suffix>
                  </InputGroup>
                  <FieldError />
                </TextField>

                <div className="flex justify-end gap-2 mt-2">
                  <Button type="submit" fullWidth isDisabled={loading}>
                    {loading ? "Restableciendo..." : "Restablecer contraseña"}
                  </Button>
                </div>
              </Form>

              <div className="flex justify-center gap-2 mt-2">
                <p className="text-muted">¿No solicitaste este cambio? </p>
                <button type="button" onClick={handleDiscard} disabled={discarding} className="link gap-1 flex items-center">
                  {discarding ? "Cancelando..." : "Cancelar solicitud"}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </Surface>
  );
}
