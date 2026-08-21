import {
  Button,
  HOME_BY_ROLE,
  Icon,
  Router,
  SessionRole,
  toast,
  useSession,
  Surface,
  Form,
  TextField,
  Label,
  Input,
  FieldError,
  InputGroup,
  Description,
  Link,
} from "@nextticket-frontend/commons";
import { CSSProperties, FormEvent, useEffect, useRef, useState } from "react";
import { login, register, toFriendlyAuthError } from "../api";

const WELCOME_LABEL_BY_ROLE: Record<SessionRole, string> = {
  usuario: "cliente",
  organizador: "organizador",
  validador: "validador",
  admin: "administrador",
};

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
      toast.danger(toFriendlyAuthError(err, "No se pudo iniciar sesión. Intenta de nuevo."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Surface className="flex flex-col gap-6 bg-background shadow-overlay rounded-[10px] w-full max-w-[400px] max-h-full overflow-y-auto p-10 pointer-events-auto">
      <div className="flex justify-between gap-4">
        <Router.Link to="/" className="link gap-1">
          <Link.Icon>
            <Icon.ChevronLeft />
          </Link.Icon>
          Inicio
        </Router.Link>
      </div>
      <div className="flex flex-col gap-2">
        <h1>
          ¡Bienvenido de nuevo!
        </h1>
        <p className="text-muted">
          Introduce tus datos para acceder a la aplicación.
        </p>
      </div>

      <Form className="flex flex-col gap-4 flex-1" onSubmit={handleSubmit}>
        <TextField
          isRequired
          name="email"
          type="email"
          value={email}
          onChange={(e: any) => setEmail(e.target ? e.target.value : e)}
          validate={(value) => {
            if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)) {
              return "Por favor ingresa un correo electrónico válido.";
            }
            return null;
          }}
        >
          <Label>Correo electrónico</Label>
          <Input placeholder="usuario@gmail.com" />
          <FieldError />
        </TextField>
        <TextField
          isRequired
          name="password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e: any) => setPassword(e.target ? e.target.value : e)}
        >
          <Label>Contraseña</Label>
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

        <div className="flex justify-end -mt-2">
          <Router.Link
            to="/forgot-password"
            className="link gap-1">
            ¿Olvidaste tu contraseña?
          </Router.Link>
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <Button type="submit" fullWidth isDisabled={loading}>
            <Icon.LogIn />
            {loading ? "Ingresando..." : "Ingresar"}
          </Button>
        </div>
      </Form>

      <div className="flex justify-center gap-2">
        <p className="text-muted">¿Aún no tienes una cuenta? </p>
        <button type="button" onClick={onFlip} className="link gap-1 flex items-center">
          Regístrate
          <Link.Icon>
            <Icon.ChevronRight />
          </Link.Icon>
        </button>
      </div>
    </Surface>
  );
}

function RegisterFace({ onFlip }: { onFlip: () => void }) {
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // El modelo del backend solo tiene "name": se combinan aquí para no
      // perder el campo Apellidos que ya traía este formulario.
      const fullName = [nombre.trim(), apellidos.trim()].filter(Boolean).join(" ");
      const result = await register(fullName, email);
      setDone(result.email);
    } catch (err) {
      toast.danger(toFriendlyAuthError(err, "No se pudo completar el registro. Intenta de nuevo."));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <Surface className="flex flex-col gap-6 bg-background shadow-overlay rounded-[10px] w-full max-w-[400px] max-h-full overflow-y-auto p-10 pointer-events-auto">
        <div className="flex justify-between gap-4">
          <Router.Link to="/" className="link gap-1">
            <Link.Icon>
              <Icon.ChevronLeft />
            </Link.Icon>
            Inicio
          </Router.Link>
        </div>
        
        <div className="flex justify-between items-center gap-3">
          <h1>Revisa tu correo</h1>
          <div className="flex shrink-0 size-16 items-center justify-center rounded-full bg-success/10 text-success mb-2">
            <Icon.MailCheck className="size-8!" />
          </div>
        </div>

        <p className="text-muted">
          Enviamos un enlace de activación a <span className="text-foreground font-medium">{done}</span>. Ábrelo
          para establecer tu contraseña y activar tu cuenta.
        </p>

        <Button fullWidth onPress={onFlip}>
          <Icon.LogIn />
          Volver al inicio de sesión
        </Button>
      </Surface>
    );
  }

  return (
    <Surface className="flex flex-col gap-6 bg-background shadow-overlay rounded-[10px] w-full max-w-[400px] max-h-full overflow-y-auto p-10 pointer-events-auto">
      <div className="flex justify-between gap-4">
        <Router.Link to="/" className="link gap-1">
          <Link.Icon>
            <Icon.ChevronLeft />
          </Link.Icon>
          Inicio
        </Router.Link>
      </div>
      <div className="flex flex-col gap-2">
        <h1>
          Crear cuenta
        </h1>
        <p className="text-muted">
          Únete a nosotros, introduce tus datos para registrarte.
        </p>
      </div>

      <Form className="flex flex-col gap-4 flex-1" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            isRequired
            name="nombre"
            type="text"
            value={nombre}
            onChange={(e: any) => setNombre(e.target ? e.target.value : e)}
          >
            <Label>Nombres</Label>
            <Input placeholder="Juan" />
            <FieldError />
          </TextField>
          <TextField
            isRequired
            name="apellidos"
            type="text"
            value={apellidos}
            onChange={(e: any) => setApellidos(e.target ? e.target.value : e)}
          >
            <Label>Apellidos</Label>
            <Input placeholder="García" />
            <FieldError />
          </TextField>
        </div>
        <TextField
          isRequired
          name="email"
          type="email"
          value={email}
          onChange={(e: any) => setEmail(e.target ? e.target.value : e)}
          validate={(value) => {
            if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)) {
              return "Por favor ingresa un correo electrónico válido.";
            }
            return null;
          }}
        >
          <Label>Correo electrónico</Label>
          <Input placeholder="nombre@gmail.com" />
          <FieldError />
        </TextField>

        <Description>
          Te enviaremos un correo para que establezcas tu contraseña y actives tu cuenta.
        </Description>

        <div className="flex justify-end gap-2 mt-2">
          <Button type="submit" fullWidth isDisabled={loading}>
            <Icon.UserPlus />
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </Button>
        </div>
      </Form>

      <div className="flex justify-center gap-2">
        <p className="text-muted">¿Ya tienes una cuenta? </p>
        <button type="button" onClick={onFlip} className="link gap-1 flex items-center">
          Inicia sesión
          <Link.Icon>
            <Icon.ChevronRight />
          </Link.Icon>
        </button>
      </div>
    </Surface>
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
    <div className="w-full max-w-[400px]" style={{ perspective: "1400px" }}>
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
  );
}
