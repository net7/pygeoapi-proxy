import { Form, Head, usePage } from '@inertiajs/react';
import { SaveIcon, Trash2, Upload } from 'lucide-react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import DeleteUser from '@/components/delete-user';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useInitials } from '@/hooks/use-initials';
import { edit } from '@/routes/profile';
import type { Auth, User } from '@/types';

type PageProps = {
    auth: Auth & {
        user: User;
    };
};

export default function Profile() {
    const { auth } = usePage<PageProps>().props;
    const getInitials = useInitials();

    return (
        <>
            <Head title="Profile settings" />

            <h1 className="sr-only">Profile settings</h1>

            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-6">
                    <Heading
                        variant="small"
                        title="Avatar"
                        description="Upload a custom image or use your linked provider avatar"
                    />

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <Avatar className="size-20 overflow-hidden rounded-full">
                            <AvatarImage
                                src={auth.user.avatar ?? undefined}
                                alt={auth.user.name}
                            />
                            <AvatarFallback className="rounded-full bg-neutral-200 text-lg text-black dark:bg-neutral-700 dark:text-white">
                                {getInitials(auth.user.name)}
                            </AvatarFallback>
                        </Avatar>

                        <div className="flex flex-1 flex-col gap-3">
                            <Form
                                {...ProfileController.updateAvatar.form()}
                                options={{
                                    preserveScroll: true,
                                }}
                                resetOnSuccess
                                className="flex flex-col gap-3 sm:flex-row sm:items-end"
                            >
                                {({ processing, errors, progress }) => (
                                    <>
                                        <div className="grid flex-1 gap-2">
                                            <Label htmlFor="avatar">
                                                Avatar image
                                            </Label>

                                            <Input
                                                id="avatar"
                                                type="file"
                                                name="avatar"
                                                accept="image/jpeg,image/png,image/webp"
                                            />

                                            {progress && (
                                                <progress
                                                    className="h-2 w-full"
                                                    value={progress.percentage}
                                                    max="100"
                                                    aria-label="Avatar upload progress"
                                                />
                                            )}

                                            <InputError
                                                message={errors.avatar}
                                            />
                                        </div>

                                        <Button disabled={processing}>
                                            <Upload data-icon="inline-start" />
                                            Save avatar
                                        </Button>
                                    </>
                                )}
                            </Form>

                            {auth.user.has_custom_avatar && (
                                <Form
                                    {...ProfileController.destroyAvatar.form()}
                                    options={{
                                        preserveScroll: true,
                                    }}
                                >
                                    {({ processing }) => (
                                        <Button
                                            variant="destructive"
                                            disabled={processing}
                                        >
                                            <Trash2 data-icon="inline-start" />
                                            Remove avatar
                                        </Button>
                                    )}
                                </Form>
                            )}
                        </div>
                    </div>
                </div>

                <Heading
                    variant="small"
                    title="Profile"
                    description="Update your name and email address"
                />

                <Form
                    {...ProfileController.update.form()}
                    options={{
                        preserveScroll: true,
                    }}
                    className="flex flex-col gap-6"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="name">Name</Label>

                                <Input
                                    id="name"
                                    className="mt-1 block w-full"
                                    defaultValue={auth.user.name}
                                    name="name"
                                    required
                                    autoComplete="name"
                                    placeholder="Full name"
                                />

                                <InputError
                                    className="mt-2"
                                    message={errors.name}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="email">Email address</Label>

                                <Input
                                    id="email"
                                    type="email"
                                    className="mt-1 block w-full"
                                    defaultValue={auth.user.email}
                                    name="email"
                                    required
                                    autoComplete="username"
                                    placeholder="Email address"
                                />

                                <InputError
                                    className="mt-2"
                                    message={errors.email}
                                />
                            </div>

                            <div className="flex items-center gap-4">
                                <Button
                                    disabled={processing}
                                    data-test="update-profile-button"
                                >
                                    <SaveIcon data-icon="inline-start" />
                                    Save
                                </Button>
                            </div>
                        </>
                    )}
                </Form>
            </div>

            {auth.canDeleteAccount && (
                <DeleteUser
                    usesPasswordConfirmation={auth.user.has_local_password}
                    sensitiveConfirmationUrl={auth.routes.sensitiveConfirmation}
                />
            )}
        </>
    );
}

Profile.layout = {
    breadcrumbs: [
        {
            title: 'Profile settings',
            href: edit(),
        },
    ],
};
