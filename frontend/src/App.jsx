import { BrowserRouter, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import Account from './pages/Account'
import Booking from './pages/Booking'
import BookingTables from './pages/BookingTables'
import Dashboard from './pages/Dashboard'
import Discovery from './pages/Discovery'
import Landing from './pages/Landing'
import Login from './pages/Login'
import MenuView from './pages/MenuView'
import RestaurantDetail from './pages/RestaurantDetail'
import Register from './pages/Register'

function App() {
  return (
    <AuthProvider>
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
            <Route path="/owner" element={<Dashboard role="owner" />} />
            <Route path="/manager" element={<Dashboard role="manager" />} />
            <Route path="/waiter" element={<Dashboard role="waiter" />} />
            <Route path="/chef" element={<Dashboard role="chef" />} />
            <Route path="/cashier" element={<Dashboard role="cashier" />} />
            <Route path="/host" element={<Dashboard role="host" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
