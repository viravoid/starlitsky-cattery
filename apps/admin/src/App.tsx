import { AdminLayout } from "./layouts/AdminLayout";
import { routes } from "./routes";

export function App() {
  const CurrentPage = routes.dashboard;

  return (
    <AdminLayout>
      <CurrentPage />
    </AdminLayout>
  );
}
