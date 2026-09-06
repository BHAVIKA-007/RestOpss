import { BrowserRouter, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import Account from './pages/Account'
import Booking from './pages/Booking'
import BookingTables from './pages/BookingTables'
import Dashboard from './pages/Dashboard'
import CreateRestaurant from './pages/CreateRestaurant'
import Discovery from './pages/Discovery'
import ManagerApprovals from './pages/ManagerApprovals'
import ManagerDashboard from './pages/ManagerDashboard'
import ManagerFloorPlan from './pages/ManagerFloorPlan'
import ManagerMenu from './pages/ManagerMenu'
import ManagerReports from './pages/ManagerReports'
import ManagerReservations from './pages/ManagerReservations'
import ManagerStaff from './pages/ManagerStaff'
import ManagerWaitlist from './pages/ManagerWaitlist'
import Landing from './pages/Landing'
import Login from './pages/Login'
import MenuView from './pages/MenuView'
import MyOrders from './pages/MyOrders'
import MyReservations from './pages/MyReservations'
import ManagerAssignment from './pages/ManagerAssignment'
import OwnerDashboard from './pages/OwnerDashboard'
import PlaceOrder from './pages/PlaceOrder'
import RestaurantDetail from './pages/RestaurantDetail'
import Register from './pages/Register'
import ReservationConfirm from './pages/ReservationConfirm'
import ReservationDetail from './pages/ReservationDetail'
import RestaurantOverview from './pages/RestaurantOverview'
import { SocketProvider } from './context/SocketContext'
import ManagerLayout from './components/ManagerLayout'

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/restaurants" element={<Discovery />} />
          <Route path="/discovery" element={<Discovery />} />
          <Route path="/restaurants/:id" element={<RestaurantDetail />} />
          <Route path="/restaurants/:id/menu" element={<MenuView />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/account" element={<Account />} />
            <Route path="/restaurants/:id/book" element={<Booking />} />
            <Route path="/restaurants/:id/book/tables" element={<BookingTables />} />
            <Route path="/reservations/:id/confirm" element={<ReservationConfirm />} />
            <Route path="/reservations/mine" element={<MyReservations />} />
            <Route path="/reservations/:id" element={<ReservationDetail />} />
            <Route path="/reservations/:id/order" element={<PlaceOrder />} />
            <Route path="/orders/mine" element={<MyOrders />} />
            <Route path="/owner/restaurants/new" element={<CreateRestaurant />} />
            <Route element={<ProtectedRoute role="owner" />}>
              <Route path="/owner" element={<OwnerDashboard />} />
              <Route path="/owner/restaurants/:id/manager" element={<ManagerAssignment />} />
              <Route path="/owner/restaurants/:id/overview" element={<RestaurantOverview />} />
            </Route>
            <Route element={<ProtectedRoute role="manager" />}>
              <Route element={<ManagerLayout />}>
                <Route path="/manager" element={<ManagerDashboard />} />
                <Route path="/manager/floor-plan" element={<ManagerFloorPlan />} />
                <Route path="/manager/staff" element={<ManagerStaff />} />
                <Route path="/manager/menu" element={<ManagerMenu />} />
                <Route path="/manager/approvals" element={<ManagerApprovals />} />
                <Route path="/manager/reservations" element={<ManagerReservations />} />
                <Route path="/manager/waitlist" element={<ManagerWaitlist />} />
                <Route path="/manager/reports" element={<ManagerReports />} />
              </Route>
            </Route>
            <Route path="/waiter" element={<Dashboard role="waiter" />} />
            <Route path="/chef" element={<Dashboard role="chef" />} />
            <Route path="/cashier" element={<Dashboard role="cashier" />} />
            <Route path="/host" element={<Dashboard role="host" />} />
          </Route>
          </Routes>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  )
}

export default App
