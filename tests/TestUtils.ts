// Copyright 2025 The MathWorks, Inc.

import quibble from 'quibble'

// Make sure the path to be quibbled is taken relative to the actual test
// file, not to this utils file
quibble.ignoreCallsFromThisFile()

// Used to provide a useful error message to someone attempting to call the
// stubDependency function without providing a value for DependencyExports
type ErrorHintType = { 'Please provide a value for the first type parameter when calling this function!': () => void }

// Represents a function with any number of arguments of any type, and any
// return type
type AnyFunction = (...args: any) => any

// Used to enforce that a provided value must be of type T, which must be
// of a function type
type FunctionOfType<T> = T & AnyFunction

// If T can be any arbitrary type that must satisfy the properties of a
// function, you can't create a wrapper function around a value of type
// T and say it must also be of type T, because JavaScript lets functions
// have properties! So this type represents a function that, for our
// purposes, has the same type as a function of type T (it has the same
// parameter types and return type).
type SameSignatureAs<T extends AnyFunction> = (...args: Parameters<T>) => ReturnType<T>

/**
 * Enables type-safe stubbing of a function exported individually (i.e.,
 * not as part of a class) from a module.
 * 
 * The behavior of the function being stubbed can be easily changed for
 * specific tests using the returned setter function, which replaces the
 * default stub with the function given to it.
 * 
 * The module dependent on the function being stubbed must be dynamically
 * imported after the call to this function (see `dynamicImport`).
 * 
 * The first type parameter must be provided; the correct type can be
 * obtained via `typeof import('relative/path/to/module/being/stubbed')`.
 * This path should be the same as `path`, but due to TypeScript
 * limitations, must be provided as a string literal here.
 * 
 * The second type parameter can be inferred, but providing it enables
 * stronger type checking. The recommended way to provide this type
 * parameter is `typeof functionToStub`, where `functionToStub` holds
 * the value that will be passed to the `propertyToReplace` parameter.
 * 
 * @param path The relative path, from the test file calling this
 *     function, to the module being stubbed
 * @param propertyToReplace The name of the property in the module
 *     given by `path` that corresponds to the function to be stubbed -
 *     `default` if the function is the module's default export, or
 *     the name of the function otherwise
 * @param defaultStub The default implementation of the stub
 * @returns A function that, when called with a new stub implementation
 *     as an argument, replaces the existing stub implementation with
 *     the new one (even if the function being stubbed has already been
 *     imported by the module dependent on it)
 */
export function stubDependency<DependencyExports = ErrorHintType, StubKey extends keyof DependencyExports = keyof DependencyExports> (
    path: string, propertyToReplace: StubKey, defaultStub: FunctionOfType<DependencyExports[StubKey]>
): (newStub: FunctionOfType<DependencyExports[StubKey]>) => void {
    // We want our stub to have the same signature as the function being stubbed
    // (which is of type DependencyExports[StubKey])
    type Stub = SameSignatureAs<FunctionOfType<DependencyExports[StubKey]>>

    // stubWrapper creates a closure over stub so that stub can be updated later,
    // and the new value will be used whenever the dependent module tries to
    // call the function being stubbed
    let stub: Stub = defaultStub
    const stubWrapper: Stub = ((...args) => stub(...args))

    // Replace the exports of the module at path with an object mapping the
    // property being replaced to the stub wrapper. Whenever the function
    // being replaced is called, the currently assigned stub function will
    // be called in turn.
    quibble(path, {
        [propertyToReplace]: stubWrapper
    })

    // Return a function that can be called to update the stub function
    // (i.e., change the behavior of the function being stubbed)
    return (newStub: FunctionOfType<DependencyExports[StubKey]>) => {
        stub = newStub
    }
}

/**
 * Serves as a typed version of `require` for dynamic imports.
 * 
 * Obtain the correct value for the type parameter via
 * `typeof import('relative/path/to/module/being/imported')`. This path
 * should be the same as `path`, but due to TypeScript limitations,
 * must be provided as a string literal here.
 * 
 * @param moduleContext The module to which the import path should be
 *     relative (`module` is typically the correct argument here)
 * @param path The relative path to the module to import
 * @returns The correctly typed exports of the imported module
 */
export function dynamicImport<T> (moduleContext: NodeJS.Module, path: string): T {
    return moduleContext.require(path)
}
