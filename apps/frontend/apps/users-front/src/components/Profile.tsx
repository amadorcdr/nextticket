import { Button, Icon, Description, Label, ThemeSwitcher, TextField, Input, Separator, Chip, Skeleton, Modal, Badge } from "@nextticket-frontend/commons";

export function Profile() {
    return (
        <div className="flex flex-col h-full w-full">
            {/* Full-width Banner */}
            <div className="w-full shrink-0">
                <Skeleton className="h-40 rounded-[10px] w-full duration-100" />
            </div>

            {/* Centered Content Container */}
            <div className="w-full max-w-3xl mx-auto flex flex-col flex-1 pb-12">

                {/* Header Section */}
                <div className="flex flex-row items-end justify-between md:gap-4 gap-2 -mt-6">

                    {/* Left: Avatar & Info */}
                    <div className="flex flex-col gap-3">
                        <div className="bg-accent z-20 size-11 rounded-[10px] flex items-center justify-center shadow-md">
                            <h4 className="text-accent-foreground font-bold">NU</h4>
                        </div>

                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <h2>Nombre Apellido Usuario</h2>
                                <Chip className="uppercase" size="sm">Administrador</Chip>
                            </div>
                            <p className="text-muted md:text-sm text-xs">
                                nombreapellidousuario@correo.com
                            </p>
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0 pb-1">
                        <Modal>
                            <Button variant="secondary">
                                <Icon.Palette />
                                Cambiar tema
                            </Button>
                            <Modal.Backdrop>
                                <Modal.Container>
                                    <Modal.Dialog className="sm:max-w-[400px]">
                                        <Modal.CloseTrigger />
                                        <Modal.Header>
                                            <Modal.Icon className="bg-default text-foreground">
                                                <Icon.Palette className="size-5" />
                                            </Modal.Icon>
                                            <Modal.Heading>Preferencias de tema</Modal.Heading>
                                        </Modal.Header>
                                        <Modal.Body className="py-6">
                                            <ThemeSwitcher />
                                        </Modal.Body>
                                    </Modal.Dialog>
                                </Modal.Container>
                            </Modal.Backdrop>
                        </Modal>

                        <Button variant="ghost" color="danger">
                            <Icon.LogOut />
                            Cerrar sesión
                        </Button>
                    </div>
                </div>

                {/* Main Content Area (Forms Grid) */}
                <div className="flex-1 mt-10 grid grid-cols-1 lg:grid-cols-2 gap-y-10 gap-x-16 w-full">

                    <div className="flex flex-col gap-8 h-full">
                        <div className="flex flex-col gap-6">
                            <div>
                                <h4 >
                                    Datos personales
                                </h4>
                                <Description>Actualiza tu información personal</Description>
                            </div>

                            <div className="flex flex-col gap-y-3 gap-x-2">
                                <TextField>
                                    <Label>Nombre</Label>
                                    <Input defaultValue="Nombre" />
                                </TextField>
                                <TextField>
                                    <Label>Correo electrónico</Label>
                                    <Input defaultValue="nombreapellidousuario@correo.com" />
                                </TextField>
                            </div>
                            <div className="flex justify-end">
                                <Button>
                                    <Icon.Save />
                                    Guardar cambios
                                </Button>
                            </div>
                        </div>

                    </div>

                    {/* Security Section */}
                    <div className="flex flex-col gap-8 h-full relative">
                        {/* Divider */}
                        <div className="absolute top-0 left-0 w-full h-px bg-border lg:w-px lg:h-full lg:-left-8 lg:top-0 -mt-5 lg:mt-0"></div>

                        <div className="flex flex-col gap-6">
                            <div>
                                <h4>
                                    Seguridad
                                </h4>
                                <Description>Mantén tu cuenta protegida</Description>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-2">
                                <TextField className="sm:col-span-2">
                                    <Label>Contraseña actual</Label>
                                    <Input type="password" />
                                </TextField>
                                <TextField>
                                    <Label>Nueva contraseña</Label>
                                    <Input type="password" />
                                </TextField>
                                <TextField>
                                    <Label>Confirmar contraseña</Label>
                                    <Input type="password" />
                                </TextField>
                            </div>
                            <div className="flex justify-end">
                                <Button variant="secondary">
                                    <Icon.KeyRound />
                                    Actualizar contraseña
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
