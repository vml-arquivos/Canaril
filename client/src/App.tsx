import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/_core/hooks/useAuth";
import { Spinner } from "@/components/ui/spinner";
import NotFound from "@/pages/NotFound";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import Birds from "@/pages/Birds";
import Couples from "@/pages/Couples";
import Rings from "@/pages/Rings";
import Clutches from "@/pages/Clutches";
import ControlSheetPDF from "@/pages/ControlSheetPDF";
import CageCardPrint from "@/pages/CageCardPrint";
import Cages from "@/pages/Cages";
import Championships from "@/pages/Championships";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import PedigreeTree from "@/pages/PedigreeTree";
import GeneticsCalculator from "@/pages/GeneticsCalculator";
import RingBatches from "@/pages/RingBatches";
import LoginPage from "@/pages/Login";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

// Componente para rotas protegidas
function ProtectedRoute({ component: Component, ...props }: any) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <Component {...props} />;
}

function Router() {
  const [location] = useLocation();
  const { user, loading } = useAuth();

  // Páginas públicas
  const publicPages = ["/", "/login"];
  const isPublicPage = publicPages.includes(location);

  // Se estiver carregando, mostrar spinner
  if (loading && !isPublicPage) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  return (
    <Switch>
      {/* Páginas Públicas */}
      <Route path={"/"} component={Home} />
      <Route path={"/login"} component={LoginPage} />

      {/* Páginas Protegidas */}
      <Route path={"/dashboard"}>
        {(params) => <ProtectedRoute component={Dashboard} {...params} />}
      </Route>
      <Route path={"/birds"}>
        {(params) => <ProtectedRoute component={Birds} {...params} />}
      </Route>
      <Route path={"/couples"}>
        {(params) => <ProtectedRoute component={Couples} {...params} />}
      </Route>
      <Route path={"/rings"}>
        {(params) => <ProtectedRoute component={Rings} {...params} />}
      </Route>
      <Route path={"/clutches"}>
        {(params) => <ProtectedRoute component={Clutches} {...params} />}
      </Route>
      <Route path={"/control-sheet/:coupleId"}>
        {(params) => <ProtectedRoute component={ControlSheetPDF} {...params} />}
      </Route>
      <Route path={"/ficha-gaiola/:coupleId"}>
        {(params) => <ProtectedRoute component={CageCardPrint} {...params} />}
      </Route>
      <Route path={"/cages"}>
        {(params) => <ProtectedRoute component={Cages} {...params} />}
      </Route>
      <Route path={"/championships"}>
        {(params) => <ProtectedRoute component={Championships} {...params} />}
      </Route>
      <Route path={"/reports"}>
        {(params) => <ProtectedRoute component={Reports} {...params} />}
      </Route>
      <Route path={"/settings"}>
        {(params) => <ProtectedRoute component={Settings} {...params} />}
      </Route>
      <Route path={"/pedigree/:birdId"}>
        {(params) => <ProtectedRoute component={PedigreeTree} {...params} />}
      </Route>
      <Route path={"/genetics-calculator"}>
        {(params) => <ProtectedRoute component={GeneticsCalculator} {...params} />}
      </Route>
      <Route path={"/ring-batches"}>
        {(params) => <ProtectedRoute component={RingBatches} {...params} />}
      </Route>

      {/* Fallback */}
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
