import { useState } from "react";
import { Button, Description, FieldError, Form, Input, Label, Surface, TextField, Router, Icon, Link, Logo, InputGroup } from "@nextticket-frontend/commons";

export function SignUp() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <Surface className="flex flex-col gap-8 bg-background shadow-overlay rounded-[10px] max-w-[400px] p-12 pointer-events-auto">
      <div className="flex justify-between gap-4">
        <Router.Link to="/" className="link gap-1">
          <Link.Icon>
            <Icon.ChevronLeft />
          </Link.Icon>
          Inicio
        </Router.Link>

      </div>
      <div className="flex flex-col gap-4">
        <h1>
          Crear cuenta
        </h1>
        <p className="text-muted md:text-sm text-xs flex flex-wrap gap-x-2 gap-y-1">
          Únete a nosotros, introduce tus datos para registrarte.
        </p>
      </div>

      <Form className="flex flex-col gap-4 flex-1 mt-2">
        <TextField
          isRequired
          name="name"
          type="text"
        >
          <Label>Nombre completo</Label>
          <Input placeholder="Nombre completo" />
          <FieldError />
        </TextField>
        <TextField
          isRequired
          name="email"
          type="email"
          validate={(value) => {
            if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)) {
              return "Por favor ingresa un correo electrónico válido";
            }
            return null;
          }}
        >
          <Label>Correo electrónico</Label>
          <Input placeholder="nombre@gmail.com" />
          <FieldError />
        </TextField>
        <TextField
          isRequired
          minLength={8}
          name="password"
          type={showPassword ? "text" : "password"}
          validate={(value) => {
            if (value.length < 8) {
              return "La contraseña debe tener al menos 8 caracteres";
            }
            if (!/[A-Z]/.test(value)) {
              return "La contraseña debe contener al menos una letra mayúscula";
            }
            if (!/[0-9]/.test(value)) {
              return "La contraseña debe contener al menos un número";
            }
            return null;
          }}
        >
          <Label>Contraseña</Label>
          <InputGroup>
            <InputGroup.Input placeholder="Crea una contraseña segura" />
            <InputGroup.Suffix>
              <Button isIconOnly size="sm" variant="ghost" onPress={() => setShowPassword(!showPassword)}>
                {showPassword ? <Icon.EyeOff /> : <Icon.Eye />}
              </Button>
            </InputGroup.Suffix>
          </InputGroup>
          <Description>Debe tener al menos 8 caracteres con 1 mayúscula y 1 número</Description>
          <FieldError />
        </TextField>
        <TextField
          isRequired
          minLength={8}
          name="confirmPassword"
          type={showConfirmPassword ? "text" : "password"}
          validate={(value) => {
            if (value.length < 8) {
              return "La contraseña debe tener al menos 8 caracteres";
            }
            if (!/[A-Z]/.test(value)) {
              return "La contraseña debe contener al menos una letra mayúscula";
            }
            if (!/[0-9]/.test(value)) {
              return "La contraseña debe contener al menos un número";
            }
            return null;
          }}
        >
          <Label>Confirmar contraseña</Label>
          <InputGroup>
            <InputGroup.Input placeholder="Vuelve a escribir tu contraseña" />
            <InputGroup.Suffix>
              <Button isIconOnly size="sm" variant="ghost" onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                {showConfirmPassword ? <Icon.EyeOff /> : <Icon.Eye />}
              </Button>
            </InputGroup.Suffix>
          </InputGroup>
          <Description>Asegúrate de que coincida con la contraseña anterior</Description>
          <FieldError />
        </TextField>
        <div className="flex justify-end gap-2 mt-6">
          <Button type="submit" fullWidth>
            <Icon.LogIn />
            Registrarse
          </Button>
        </div>
      </Form>

      <div className="flex justify-center gap-2">
        <p className="text-muted">¿Ya tienes una cuenta? </p>
        <Router.Link to="/sign-in" className="link gap-1">
          Iniciar sesión

          <Link.Icon>
            <Icon.ChevronRight />
          </Link.Icon>
        </Router.Link>
      </div>

    </Surface>
  );
}
