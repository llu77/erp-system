/**
 * 🛒 usePOSCart - Custom Hook لإدارة سلة الكاشير
 * 
 * يطبق أنماط React المتقدمة:
 * - useReducer للحالات المعقدة
 * - useMemo للتحسين
 * - useCallback لمنع Re-renders
 */

import { useReducer, useMemo, useCallback } from 'react';

// Types
export interface CartItem {
  id: number;
  serviceId: number;
  serviceName: string;
  categoryName: string;
  price: number;
  quantity: number;
  discount: number;
  discountType: 'percentage' | 'fixed';
  employeeId?: number;
  employeeName?: string;
  notes?: string;
}

export interface CartState {
  items: CartItem[];
  customerId?: number;
  customerName?: string;
  customerPhone?: string;
  globalDiscount: number;
  globalDiscountType: 'percentage' | 'fixed';
  paymentMethod: 'cash' | 'card' | 'transfer' | 'mixed';
  cashAmount: number;
  cardAmount: number;
  transferAmount: number;
  notes: string;
}

// Action Types
type CartAction =
  | { type: 'ADD_ITEM'; payload: Omit<CartItem, 'id' | 'quantity'> }
  | { type: 'REMOVE_ITEM'; payload: { id: number } }
  | { type: 'UPDATE_QUANTITY'; payload: { id: number; quantity: number } }
  | { type: 'UPDATE_DISCOUNT'; payload: { id: number; discount: number; discountType: 'percentage' | 'fixed' } }
  | { type: 'UPDATE_EMPLOYEE'; payload: { id: number; employeeId: number; employeeName: string } }
  | { type: 'UPDATE_NOTES'; payload: { id: number; notes: string } }
  | { type: 'SET_CUSTOMER'; payload: { customerId?: number; customerName?: string; customerPhone?: string } }
  | { type: 'SET_GLOBAL_DISCOUNT'; payload: { discount: number; discountType: 'percentage' | 'fixed' } }
  | { type: 'SET_PAYMENT_METHOD'; payload: { method: 'cash' | 'card' | 'transfer' | 'mixed' } }
  | { type: 'SET_PAYMENT_AMOUNTS'; payload: { cash?: number; card?: number; transfer?: number } }
  | { type: 'SET_NOTES'; payload: { notes: string } }
  | { type: 'CLEAR_CART' }
  | { type: 'LOAD_CART'; payload: CartState };

// Initial State
const initialState: CartState = {
  items: [],
  globalDiscount: 0,
  globalDiscountType: 'percentage',
  paymentMethod: 'cash',
  cashAmount: 0,
  cardAmount: 0,
  transferAmount: 0,
  notes: '',
};

// Reducer
function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      // Check if item already exists
      const existingIndex = state.items.findIndex(
        item => item.serviceId === action.payload.serviceId && 
                item.employeeId === action.payload.employeeId
      );

      if (existingIndex >= 0) {
        // Increment quantity
        const newItems = [...state.items];
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          quantity: newItems[existingIndex].quantity + 1,
        };
        return { ...state, items: newItems };
      }

      // Add new item
      const newItem: CartItem = {
        ...action.payload,
        id: Date.now(),
        quantity: 1,
      };
      return { ...state, items: [...state.items, newItem] };
    }

    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter(item => item.id !== action.payload.id),
      };

    case 'UPDATE_QUANTITY': {
      if (action.payload.quantity <= 0) {
        return {
          ...state,
          items: state.items.filter(item => item.id !== action.payload.id),
        };
      }
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload.id
            ? { ...item, quantity: action.payload.quantity }
            : item
        ),
      };
    }

    case 'UPDATE_DISCOUNT':
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload.id
            ? { ...item, discount: action.payload.discount, discountType: action.payload.discountType }
            : item
        ),
      };

    case 'UPDATE_EMPLOYEE':
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload.id
            ? { ...item, employeeId: action.payload.employeeId, employeeName: action.payload.employeeName }
            : item
        ),
      };

    case 'UPDATE_NOTES':
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload.id
            ? { ...item, notes: action.payload.notes }
            : item
        ),
      };

    case 'SET_CUSTOMER':
      return {
        ...state,
        customerId: action.payload.customerId,
        customerName: action.payload.customerName,
        customerPhone: action.payload.customerPhone,
      };

    case 'SET_GLOBAL_DISCOUNT':
      return {
        ...state,
        globalDiscount: action.payload.discount,
        globalDiscountType: action.payload.discountType,
      };

    case 'SET_PAYMENT_METHOD':
      return {
        ...state,
        paymentMethod: action.payload.method,
      };

    case 'SET_PAYMENT_AMOUNTS':
      return {
        ...state,
        cashAmount: action.payload.cash ?? state.cashAmount,
        cardAmount: action.payload.card ?? state.cardAmount,
        transferAmount: action.payload.transfer ?? state.transferAmount,
      };

    case 'SET_NOTES':
      return {
        ...state,
        notes: action.payload.notes,
      };

    case 'CLEAR_CART':
      return initialState;

    case 'LOAD_CART':
      return action.payload;

    default:
      return state;
  }
}

// Hook
export function usePOSCart() {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  // Calculated Values with Memoization
  const calculations = useMemo(() => {
    // Calculate item totals
    const itemsWithTotals = state.items.map(item => {
      const baseTotal = item.price * item.quantity;
      let discountAmount = 0;
      
      if (item.discount > 0) {
        if (item.discountType === 'percentage') {
          discountAmount = baseTotal * (item.discount / 100);
        } else {
          discountAmount = item.discount * item.quantity;
        }
      }
      
      return {
        ...item,
        baseTotal,
        discountAmount,
        finalTotal: baseTotal - discountAmount,
      };
    });

    // Calculate subtotal
    const subtotal = itemsWithTotals.reduce((sum, item) => sum + item.finalTotal, 0);

    // Calculate global discount
    let globalDiscountAmount = 0;
    if (state.globalDiscount > 0) {
      if (state.globalDiscountType === 'percentage') {
        globalDiscountAmount = subtotal * (state.globalDiscount / 100);
      } else {
        globalDiscountAmount = state.globalDiscount;
      }
    }

    // Calculate final total
    const total = subtotal - globalDiscountAmount;

    // Calculate total discount
    const totalDiscount = itemsWithTotals.reduce((sum, item) => sum + item.discountAmount, 0) + globalDiscountAmount;

    // Calculate VAT (15%)
    const vatRate = 0.15;
    const vatAmount = total * vatRate;
    const totalWithVat = total + vatAmount;

    // Calculate remaining amount
    const paidAmount = state.cashAmount + state.cardAmount + state.transferAmount;
    const remainingAmount = total - paidAmount;

    return {
      itemsWithTotals,
      itemCount: state.items.length,
      totalQuantity: state.items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
      globalDiscountAmount,
      totalDiscount,
      total,
      vatAmount,
      totalWithVat,
      paidAmount,
      remainingAmount,
      isFullyPaid: remainingAmount <= 0,
    };
  }, [state.items, state.globalDiscount, state.globalDiscountType, state.cashAmount, state.cardAmount, state.transferAmount]);

  // Actions with useCallback
  const addItem = useCallback((item: Omit<CartItem, 'id' | 'quantity'>) => {
    dispatch({ type: 'ADD_ITEM', payload: item });
  }, []);

  const removeItem = useCallback((id: number) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { id } });
  }, []);

  const updateQuantity = useCallback((id: number, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
  }, []);

  const incrementQuantity = useCallback((id: number) => {
    const item = state.items.find(i => i.id === id);
    if (item) {
      dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity: item.quantity + 1 } });
    }
  }, [state.items]);

  const decrementQuantity = useCallback((id: number) => {
    const item = state.items.find(i => i.id === id);
    if (item) {
      dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity: item.quantity - 1 } });
    }
  }, [state.items]);

  const updateDiscount = useCallback((id: number, discount: number, discountType: 'percentage' | 'fixed') => {
    dispatch({ type: 'UPDATE_DISCOUNT', payload: { id, discount, discountType } });
  }, []);

  const updateEmployee = useCallback((id: number, employeeId: number, employeeName: string) => {
    dispatch({ type: 'UPDATE_EMPLOYEE', payload: { id, employeeId, employeeName } });
  }, []);

  const updateItemNotes = useCallback((id: number, notes: string) => {
    dispatch({ type: 'UPDATE_NOTES', payload: { id, notes } });
  }, []);

  const setCustomer = useCallback((customer: { customerId?: number; customerName?: string; customerPhone?: string }) => {
    dispatch({ type: 'SET_CUSTOMER', payload: customer });
  }, []);

  const setGlobalDiscount = useCallback((discount: number, discountType: 'percentage' | 'fixed') => {
    dispatch({ type: 'SET_GLOBAL_DISCOUNT', payload: { discount, discountType } });
  }, []);

  const setPaymentMethod = useCallback((method: 'cash' | 'card' | 'transfer' | 'mixed') => {
    dispatch({ type: 'SET_PAYMENT_METHOD', payload: { method } });
  }, []);

  const setPaymentAmounts = useCallback((amounts: { cash?: number; card?: number; transfer?: number }) => {
    dispatch({ type: 'SET_PAYMENT_AMOUNTS', payload: amounts });
  }, []);

  const setNotes = useCallback((notes: string) => {
    dispatch({ type: 'SET_NOTES', payload: { notes } });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART' });
  }, []);

  const loadCart = useCallback((cartState: CartState) => {
    dispatch({ type: 'LOAD_CART', payload: cartState });
  }, []);

  // Export cart data for saving
  const exportCartData = useCallback(() => {
    return {
      items: state.items,
      customerId: state.customerId,
      customerName: state.customerName,
      customerPhone: state.customerPhone,
      globalDiscount: state.globalDiscount,
      globalDiscountType: state.globalDiscountType,
      paymentMethod: state.paymentMethod,
      cashAmount: state.cashAmount,
      cardAmount: state.cardAmount,
      transferAmount: state.transferAmount,
      notes: state.notes,
      ...calculations,
    };
  }, [state, calculations]);

  return {
    // State
    state,
    ...calculations,

    // Actions
    addItem,
    removeItem,
    updateQuantity,
    incrementQuantity,
    decrementQuantity,
    updateDiscount,
    updateEmployee,
    updateItemNotes,
    setCustomer,
    setGlobalDiscount,
    setPaymentMethod,
    setPaymentAmounts,
    setNotes,
    clearCart,
    loadCart,
    exportCartData,
  };
}

export default usePOSCart;
