import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/_core/hooks/useAuth";
import { Spinner } from "@/components/ui/spinner";
import { lazy, Suspense } from "react";
import NotFound from "@/pages/NotFound";
import LoginPage from "@/pages/Login";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

// Páginas leves — carregadas imediatamente
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";

// Páginas pesadas — lazy loaded para reduzir o bundle inicial
const Birds = lazy(() => import("@/pages/Birds"));
const Couples = lazy(() => import("@/pages/Couples"));
const Rings = lazy(() => import("@/pages/Rings"));
const Clutches = lazy(() => import("@/pages/Clutches"));
const ControlSheetPDF = lazy(() => import("@/pages/ControlSheetPDF"));
const CageCardPrint = lazy(() => import("@/pages/CageCardPrint"));
const Cages = lazy(() => import("@/pages/Cages"));
const Championships = lazy(() => import("@/pages/Championships"));
const Reports = lazy(() => import("@/pages/Reports"));
const GeneticReport = lazy(() => import("@/pages/GeneticReport"));
const Settings = lazy(() => import("@/pages/Settings"));
const PedigreeTree = lazy(() => import("@/pages/PedigreeTree"));
const GeneticsCalculator = lazy(() => import("@/pages/GeneticsCalculator"));
const RingBatches = lazy(() => import("@/pages/RingBatches"));
const Temporada = lazy(() => import("@/pages/Temporada"));
const CriadouroMapa = lazy(() => import("@/pages/CriadouroMapa"));
const BirdFichaPage = lazy(() => import("@/pages/BirdFichaPage"));
const GuiasIndex = lazy(() => import("@/pages/GuiasPublico").then(m => ({ default: m.GuiasIndex })));
const GuiaIndividual = lazy(() => import("@/pages/GuiasPublico").then(m => ({ default: m.GuiaIndividual })));
const FAQPublico = lazy(() => import("@/pages/GuiasPublico").then(m => ({ default: m.FAQPublico })));
const GlossarioPublico = lazy(() => import("@/pages/GuiasPublico").then(m => ({ default: m.GlossarioPublico })));
const PublicBirdPage = lazy(() => import("@/pages/PublicBirdPage"));

// Fallback de loading para lazy pages
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Spinner />
    </div>
  );
}

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
  const publicPages = ["/", "/login", "/guias", "/faq", "/glossario"];
  const isPublicPage = publicPages.includes(location)
    || location.startsWith("/guias/")
    || location.startsWith("/p/")
    || location.startsWith("/g/");

  // Se estiver carregando, mostrar spinner
  if (loading && !isPublicPage) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
    <Switch>
      {/* Páginas Públicas */}
      <Route path={"/"} component={Home} />
      <Route path={"/login"} component={LoginPage} />

      {/* Portal Educativo Público (SEO) */}
      <Route path={"/guias"} component={GuiasIndex} />
      <Route path={"/guias/:slug"} component={GuiaIndividual} />
      <Route path={"/faq"} component={FAQPublico} />
      <Route path={"/glossario"} component={GlossarioPublico} />

      {/* QR Code — fichas públicas */}
      <Route path={"/p/:code"} component={PublicBirdPage} />
      <Route path={"/g/:code"} component={PublicBirdPage} />

      {/* Páginas Protegidas */}
      <Route path={"/dashboard"}>
        {(params) => <ProtectedRoute component={Dashboard} {...params} />}
      </Route>
      <Route path={"/birds"}>
        {(params) => <ProtectedRoute component={Birds} {...params} />}
      </Route>
      <Route path={"/birds/:birdId/ficha"}>
        {(params) => <ProtectedRoute component={BirdFichaPage} {...params} />}
      </Route>
      <Route path={"/couples"}>
        {(params) => <ProtectedRoute component={Couples} {...params} />}
      </Route>
      <Route path={"/rings"}>
        {(params) => <ProtectedRoute component={RingBatches} {...params} />}
      </Route>
      <Route path={"/rings-legado"}>
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
      <Route path={"/genetic-report"}>
        {(params) => <ProtectedRoute component={GeneticReport} {...params} />}
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
      <Route path={"/temporada"}>
        {(params) => <ProtectedRoute component={Temporada} {...params} />}
      </Route>
      <Route path={"/criadouro-mapa"}>
        {(params) => <ProtectedRoute component={CriadouroMapa} {...params} />}
      </Route>

      {/* Fallback */}
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
    </Suspense>
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
