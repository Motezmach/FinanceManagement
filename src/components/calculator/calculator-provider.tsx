"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useState,
  type ActionDispatch,
  type ReactNode,
} from "react";
import {
  calculatorReducer,
  EMPTY_CALCULATOR,
  evaluateState,
  type CalculatorAction,
  type CalculatorState,
  type Evaluation,
} from "@/lib/calculator/engine";

type CalculatorApi = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  /** The live result, unrounded. Null while the tape is empty or in error. */
  result: number | null;
  insert: (amount: number, label?: string) => void;
};

type CalculatorTape = { state: CalculatorState; evaluation: Evaluation | null };

type CalculatorControls = {
  dispatch: ActionDispatch<[CalculatorAction]>;
  insert: (amount: number, label?: string) => void;
  /** Changes whenever the server re-renders the app layout, which only follows a mutation. */
  revision: string;
};

const ApiContext = createContext<CalculatorApi>({
  open: false,
  setOpen: () => {},
  toggle: () => {},
  result: null,
  insert: () => {},
});

const TapeContext = createContext<CalculatorTape>({ state: EMPTY_CALCULATOR, evaluation: null });

// Apart from the revision this never changes, so the long list of Ledger chips can
// use it without re-rendering on every key press.
const ControlsContext = createContext<CalculatorControls>({
  dispatch: () => {},
  insert: () => {},
  revision: "",
});

export function CalculatorProvider({ revision, children }: { revision: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [state, dispatch] = useReducer(calculatorReducer, EMPTY_CALCULATOR);

  const toggle = useCallback(() => setOpen((current) => !current), []);
  const insert = useCallback((amount: number, label?: string) => dispatch({ type: "insert", amount, label }), []);

  const evaluation = useMemo(() => evaluateState(state), [state]);
  const result = evaluation?.ok ? evaluation.value : null;

  const api = useMemo(() => ({ open, setOpen, toggle, result, insert }), [open, toggle, result, insert]);
  const tape = useMemo(() => ({ state, evaluation }), [state, evaluation]);
  const controls = useMemo(() => ({ dispatch, insert, revision }), [insert, revision]);

  return (
    <ApiContext.Provider value={api}>
      <ControlsContext.Provider value={controls}>
        <TapeContext.Provider value={tape}>{children}</TapeContext.Provider>
      </ControlsContext.Provider>
    </ApiContext.Provider>
  );
}

export function useCalculator() {
  return useContext(ApiContext);
}

export function useCalculatorTape() {
  return useContext(TapeContext);
}

export function useCalculatorControls() {
  return useContext(ControlsContext);
}
