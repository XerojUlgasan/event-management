import { Avatar } from "@event-management/ui";
import { initialsFromName } from "../../lib/utils/formatting/name";
import { SignInMethods } from "./SignInMethods";

export function AccountSettings({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  return (
    <section
      className="account-settings"
      aria-labelledby="account-settings-title"
    >
      <header className="account-settings-heading">
        <h1 id="account-settings-title" className="page-title">
          Account settings
        </h1>
      </header>
      <div className="account-settings-layout">
        <section
          className="account-profile"
          aria-labelledby="account-profile-title"
        >
          <h2 id="account-profile-title">Profile</h2>
          <Avatar initials={initialsFromName(name)} size="lg" />
          <p className="account-profile-name">{name}</p>
          <dl>
            <div>
              <dt>Email address</dt>
              <dd>{email}</dd>
            </div>
          </dl>
        </section>
        <SignInMethods />
      </div>
    </section>
  );
}
