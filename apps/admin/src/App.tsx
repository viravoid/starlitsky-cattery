import { AdminLayout } from "./layouts/AdminLayout";
import { routes } from "./routes";

export function App() {
  const CurrentPage = routes.catteryManagement;

  return (
    <AdminLayout>
      <CurrentPage />
    </AdminLayout>
  );
}
