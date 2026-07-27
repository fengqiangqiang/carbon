import { error, getRedirectTo, NODE_ENV, VERCEL_ENV } from "@carbon/auth";
import {
  signInWithBypassEmail,
  verifyAuthSession
} from "@carbon/auth/auth.server";
import {
  flash,
  getAuthSession,
  setAuthSession
} from "@carbon/auth/session.server";
import { getUserByEmail } from "@carbon/auth/users.server";
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { path } from "~/utils/path";

export async function loader({ request }: LoaderFunctionArgs) {
  const redirectTo = getRedirectTo(request);
  const existingAuthSession = await getAuthSession(request);

  if (existingAuthSession && (await verifyAuthSession(existingAuthSession))) {
    throw redirect(redirectTo);
  }

  if (NODE_ENV === "production" || VERCEL_ENV === "production") {
    throw redirect(
      path.to.login,
      await flash(
        request,
        error(null, "Dev login is only available in local development")
      )
    );
  }

  const email = process.env.DEV_BYPASS_EMAIL;

  if (!email) {
    throw redirect(
      path.to.login,
      await flash(request, error(null, "DEV_BYPASS_EMAIL is not configured"))
    );
  }

  const user = await getUserByEmail(email);

  if (user.error || !user.data?.active) {
    throw redirect(
      path.to.login,
      await flash(
        request,
        error(null, `Dev login user ${email} was not found or is inactive`)
      )
    );
  }

  const authSession = await signInWithBypassEmail(email);

  if (!authSession) {
    throw redirect(
      path.to.login,
      await flash(request, error(null, "Failed to create dev login session"))
    );
  }

  const sessionCookie = await setAuthSession(request, { authSession });

  throw redirect(redirectTo, {
    headers: [["Set-Cookie", sessionCookie]]
  });
}
