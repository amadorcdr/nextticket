import {
  Button,
  Icon,
  Router,
  Surface,
  Form,
  TextField,
  Label,
  Input,
  FieldError,
  Link,
} from "@nextticket-frontend/commons";
import { FormEvent, useState } from "react";
import { forgotPassword } from "../api";

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






    <Surface className="flex flex-col gap-6 bg-background shadow-overlay rounded-[10px] w-full max-w-[400px] max-h-full overflow-y-auto p-10 pointer-events-auto">
      {sent ? (
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
            <h1>Revisa tu correo</h1>
            <div className="flex shrink-0 size-16 items-center justify-center rounded-full bg-success/10 text-success mb-2">
              <Icon.MailCheck className="size-8!" />
            </div>
          </div>

          <p className="text-muted">
            Si existe una cuenta asociada a <span className="text-foreground font-medium">{email}</span>, recibirás
            un enlace para restablecer tu contraseña. Si no lo encuentras, revisa tu bandeja de spam.
          </p>

          <Button fullWidth onPress={() => navigate("/sign-in")}>
            <Icon.LogIn />
            Volver al inicio de sesión
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
          <div className="flex flex-col gap-2">
            <h1>Recuperar contraseña</h1>
            <p className="text-muted">Ingresa el correo asociado a tu cuenta.</p>
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

            <div className="flex justify-end gap-2 mt-2">
              <Button type="submit" fullWidth isDisabled={loading}>
                <Icon.Send />

                {loading ? "Enviando..." : "Enviar enlace de recuperación"}
              </Button>
            </div>
          </Form>

          <div className="flex justify-center gap-2">
            <p className="text-muted">¿Aún no tienes una cuenta? </p>
            <Router.Link to="/sign-up" className="link gap-1 flex items-center">
              Regístrate
              <Link.Icon>
                <Icon.ChevronRight />
              </Link.Icon>
            </Router.Link>
          </div>
        </>
      )}
    </Surface>
  );
}
