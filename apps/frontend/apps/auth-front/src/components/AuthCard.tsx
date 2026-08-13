import {
  Button,
  HeroParticles,
  HeroWaves,
  HOME_BY_ROLE,
  Icon,
  Router,
  SessionRole,
  toast,
  useSession,
} from "@nextticket-frontend/commons";
import { CSSProperties, FormEvent, useEffect, useRef, useState } from "react";
import { InputField, authCardClassName } from "./AuthCardUI";
import { AccountDisabledError, InvalidCredentialsError, login } from "../api";

const WELCOME_LABEL_BY_ROLE: Record<SessionRole, string> = {
  usuario: "cliente",
  organizador: "organizador",
  validador: "validador",
  admin: "administrador",
};

function BackToHome() {
  return (
    <div className="flex mb-3">
      <Router.Link
        to="/"
        className="inline-flex items-center gap-1 text-muted hover:text-foreground text-xs transition-colors"
      >
        <Icon.ChevronLeft className="w-3.5 h-3.5" />
        Inicio
      </Router.Link>
    </div>
  );
}

function LoginFace({ onFlip }: { onFlip: () => void }) {
  const navigate = Router.useNavigate();
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await login(email, password);

      // Se guarda la sesión antes de navegar: así cada layout sabe quién entró
      // y el usuario llega a su pantalla ya identificado.
      signIn({
        id: result.id,
        name: result.name,
        email: result.email,
        role: result.role,
        token: result.token,
      });

      toast.success(`Bienvenido, ${result.name} (${WELCOME_LABEL_BY_ROLE[result.role]})`);
      navigate(HOME_BY_ROLE[result.role]);
    } catch (err) {
      toast.danger(
        err instanceof InvalidCredentialsError || err instanceof AccountDisabledError
          ? err.message
          : "No se pudo iniciar sesión. Intenta de nuevo.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`w-full rounded-[24px] p-5 ${authCardClassName}`}>
      <BackToHome />

      <div className="text-center mb-4 pb-4 border-b border-border">
        <h1 className="text-foreground font-bold text-lg tracking-tight mb-1">Inicio de sesión</h1>
        <p className="text-muted text-xs">Accede a tu cuenta para gestionar tus eventos</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <InputField
          id="signin-email"
          label="Correo electrónico"
          type="email"
          placeholder="nombre@ejemplo.com"
          value={email}
          onChange={setEmail}
          icon={<Icon.Mail className="w-4 h-4" />}
        />
        <InputField
          id="signin-password"
          label="Contraseña"
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
        <div className="flex justify-end -mt-1">
          <a href="#" className="text-muted text-[11px] hover:text-foreground transition-colors">
            ¿Olvidaste tu contraseña?
          </a>
        </div>
        <Button type="submit" fullWidth isDisabled={loading}>
          <Icon.LogIn />
          {loading ? "Ingresando..." : "Ingresar"}
        </Button>
      </form>

      <div className="mt-3 pt-3 text-center border-t border-border">
        <p className="text-muted text-xs">
          ¿No tienes una cuenta?{" "}
          <button
            type="button"
            onClick={onFlip}
            className="text-foreground font-semibold hover:opacity-70 transition-opacity ml-0.5"
          >
            Regístrate
          </button>
        </p>
      </div>
    </div>
  );
}

function RegisterFace({ onFlip }: { onFlip: () => void }) {
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div className={`w-full rounded-[24px] p-5 ${authCardClassName}`}>
      <BackToHome />

      <div className="text-center mb-4 pb-4 border-b border-border">
        <h1 className="text-foreground font-bold text-lg tracking-tight mb-1">Crear cuenta</h1>
        <p className="text-muted text-xs">Únete y empieza a vivir los mejores eventos</p>
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <InputField
            id="signup-nombre"
            label="Nombre"
            placeholder="Juan"
            value={nombre}
            onChange={setNombre}
            icon={<Icon.User className="w-4 h-4" />}
          />
          <InputField
            id="signup-apellidos"
            label="Apellidos"
            placeholder="García"
            value={apellidos}
            onChange={setApellidos}
            icon={<Icon.User className="w-4 h-4" />}
          />
        </div>
        <InputField
          id="signup-email"
          label="Correo electrónico"
          type="email"
          placeholder="nombre@ejemplo.com"
          value={email}
          onChange={setEmail}
          icon={<Icon.Mail className="w-4 h-4" />}
        />
        <InputField
          id="signup-password"
          label="Contraseña"
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
          id="signup-confirm-password"
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
        <Button type="submit" fullWidth>
          <Icon.UserPlus />
          Crear cuenta
        </Button>
      </form>

      <div className="mt-3 pt-3 text-center border-t border-border">
        <p className="text-muted text-xs">
          ¿Ya tienes una cuenta?{" "}
          <button
            type="button"
            onClick={onFlip}
            className="text-foreground font-semibold hover:opacity-70 transition-opacity ml-0.5"
          >
            Inicia sesión
          </button>
        </p>
      </div>
    </div>
  );
}

const faceStyle = (backface: boolean): CSSProperties => ({
  position: "absolute",
  top: "50%",
  left: 0,
  width: "100%",
  transform: backface ? "rotateY(180deg) translateY(-50%)" : "translateY(-50%)",
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
});

/*
 * SignIn y SignUp son el mismo componente (ver components/SignIn.tsx y SignUp.tsx):
 * al ser el mismo tipo de elemento en las dos rutas hermanas, React no lo desmonta
 * al navegar entre /sign-in y /sign-up, así que el flip 3D anima en vez de cortarse.
 */
const FLIP_DURATION_MS = 650;

export function AuthCard() {
  const location = Router.useLocation();
  const navigate = Router.useNavigate();
  const [flipped, setFlipped] = useState(() => location.pathname === "/sign-up");
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const [containerH, setContainerH] = useState<number | undefined>(undefined);
  const navigateTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    setFlipped(location.pathname === "/sign-up");
  }, [location.pathname]);

  useEffect(() => {
    const frontH = frontRef.current?.offsetHeight ?? 0;
    const backH = backRef.current?.offsetHeight ?? 0;
    setContainerH(Math.max(frontH, backH));
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(navigateTimeoutRef.current);
  }, []);

  const flip = () => {
    const next = !flipped;
    setFlipped(next);
    // La navegación se retrasa hasta que termina el giro: si cambiamos la
    // ruta de inmediato, react-router puede remontar el componente a mitad
    // de la animación y la transición nunca llega a verse.
    window.clearTimeout(navigateTimeoutRef.current);
    navigateTimeoutRef.current = window.setTimeout(() => {
      navigate(next ? "/sign-up" : "/sign-in", { replace: true });
    }, FLIP_DURATION_MS);
  };

  return (
    <div className="relative w-full min-h-screen flex items-center justify-center px-4 py-10 bg-background overflow-hidden">
      <HeroWaves />
      <HeroParticles />

      <div className="relative z-10 w-full max-w-88" style={{ perspective: "1400px" }}>
        <div
          style={{
            position: "relative",
            height: containerH,
            transformStyle: "preserve-3d",
            transition: `transform ${FLIP_DURATION_MS}ms cubic-bezier(0.4, 0.2, 0.2, 1)`,
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          <div ref={frontRef} style={faceStyle(false)}>
            <LoginFace onFlip={flip} />
          </div>
          <div ref={backRef} style={faceStyle(true)}>
            <RegisterFace onFlip={flip} />
          </div>
        </div>
      </div>
    </div>
  );
}
