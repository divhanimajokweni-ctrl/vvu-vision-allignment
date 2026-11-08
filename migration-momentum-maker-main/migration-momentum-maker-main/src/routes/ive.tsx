import { createFileRoute, Outlet } from "@tanstack/react-router";
import { IveBackdrop } from "@/components/ive-site/IveBackdrop";

export const Route = createFileRoute("/ive")({
  component: () => (
    <IveBackdrop>
      <Outlet />
    </IveBackdrop>
  ),
});
