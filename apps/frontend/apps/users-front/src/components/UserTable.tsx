import { Button, Chip, Icon, Table } from "@nextticket-frontend/commons";
import { ROLE_LABELS, type AdminUser } from "../types/user";

interface UserTableProps {
    users: AdminUser[];
    onView: (user: AdminUser) => void;
    onEdit: (user: AdminUser) => void;
    onToggleStatus: (user: AdminUser) => void;
}

export function UserTable({ users, onView, onEdit, onToggleStatus }: UserTableProps) {
    return (
        <Table>
            <Table.ScrollContainer>
                <Table.Content aria-label="Usuarios" className="min-w-160 text-xs">
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
                                    <span className="text-foreground text-xs font-medium">
                                        {user.firstName} {user.lastName}
                                    </span>
                                </Table.Cell>
                                <Table.Cell className="text-center">
                                    <span className="text-muted text-xs">{user.email}</span>
                                </Table.Cell>
                                <Table.Cell className="text-center">
                                    <Chip size="sm" variant="soft">
                                        {ROLE_LABELS[user.role]}
                                    </Chip>
                                </Table.Cell>
                                <Table.Cell className="text-center">
                                    <Chip size="sm" variant="soft" color={user.status === "active" ? "success" : "default"}>
                                        {user.status === "active" ? "Activo" : "Inactivo"}
                                    </Chip>
                                </Table.Cell>
                                <Table.Cell className="text-center">
                                    <span className="text-xs">{user.createdAt}</span>
                                </Table.Cell>
                                <Table.Cell className="text-center">
                                    <div className="flex justify-center gap-1">
                                        <Button size="sm" variant="ghost" isIconOnly onPress={() => onView(user)}>
                                            <Icon.Eye />
                                        </Button>
                                        <Button size="sm" variant="ghost" isIconOnly onPress={() => onEdit(user)}>
                                            <Icon.Pencil />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant={user.status === "active" ? "danger" : "ghost"}
                                            isIconOnly
                                            onPress={() => onToggleStatus(user)}
                                        >
                                            {user.status === "active" ? <Icon.UserX /> : <Icon.UserCheck />}
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
