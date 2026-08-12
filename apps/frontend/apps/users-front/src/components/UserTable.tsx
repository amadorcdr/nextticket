import { Button, Icon, Table } from "@nextticket-frontend/commons";
import { ROLE_LABELS, type AdminUser } from "../types/user";

interface UserTableProps {
    users: AdminUser[];
    onEdit: (user: AdminUser) => void;
    onToggleStatus: (user: AdminUser) => void;
}

const ROLE_CLASSNAME: Record<AdminUser["role"], string> = {
    admin: "text-danger bg-danger/10",
    organizador: "text-accent bg-accent/10",
    validador: "text-warning bg-warning/10",
    usuario: "text-muted bg-muted/10",
};

const STATUS_CLASSNAME: Record<"true" | "false", string> = {
    true: "text-success bg-success/10",
    false: "text-muted bg-muted/10",
};

export function UserTable({ users, onEdit, onToggleStatus }: UserTableProps) {
    return (
        <Table>
            <Table.ScrollContainer>
                <Table.Content aria-label="Usuarios" className="min-w-160 max-h-100 overflow-y-auto text-xs">
                    <Table.Header>
                        <Table.Column isRowHeader id="name" minWidth={180} className="text-center">
                            Nombre
                        </Table.Column>
                        <Table.Column id="email" minWidth={200} className="text-center">
                            Correo
                        </Table.Column>
                        <Table.Column id="role" minWidth={130} className="text-center">
                            Rol
                        </Table.Column>
                        <Table.Column id="status" minWidth={100} className="text-center">
                            Estado
                        </Table.Column>
                        <Table.Column id="createdAt" minWidth={130} className="text-center">
                            Fecha de registro
                        </Table.Column>
                        <Table.Column id="actions" minWidth={120} className="text-center">
                            Acciones
                        </Table.Column>
                    </Table.Header>
                    <Table.Body items={users}>
                        {(user) => (
                            <Table.Row>
                                <Table.Cell className="text-center">
                                    <span className="text-foreground text-xs font-medium">{user.name}</span>
                                </Table.Cell>
                                <Table.Cell className="text-center">
                                    <span className="text-muted text-xs">{user.email}</span>
                                </Table.Cell>
                                <Table.Cell className="text-center">
                                    <span
                                        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${ROLE_CLASSNAME[user.role]}`}
                                    >
                                        {ROLE_LABELS[user.role]}
                                    </span>
                                </Table.Cell>
                                <Table.Cell className="text-center">
                                    <span
                                        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${STATUS_CLASSNAME[user.status ? "true" : "false"]}`}
                                    >
                                        {user.status ? "Activo" : "Inactivo"}
                                    </span>
                                </Table.Cell>
                                <Table.Cell className="text-center">
                                    <span className="text-xs">{new Date(user.createdAt).toLocaleDateString("es-MX")}</span>
                                </Table.Cell>
                                <Table.Cell className="text-center">
                                    <div className="flex justify-center gap-1">
                                        <Button size="sm" variant="ghost" isIconOnly onPress={() => onEdit(user)}>
                                            <Icon.Pencil />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            color={user.status ? "danger" : "success"}
                                            isIconOnly
                                            onPress={() => onToggleStatus(user)}
                                        >
                                            {user.status ? <Icon.UserX /> : <Icon.UserCheck />}
                                        </Button>
                                    </div>
                                </Table.Cell>
                            </Table.Row>
                        )}
                    </Table.Body>
                </Table.Content>
            </Table.ScrollContainer>
        </Table>
    );
}
