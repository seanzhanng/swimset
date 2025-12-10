import Foundation

enum APIError: Error {
    case invalidURL
    case badStatusCode(Int)
    case decodingFailed
    case encodingFailed
    case noData
}

/// Thin wrapper around URLSession for talking to the SwimSet backend.
///
/// Uses async/await and Codable.
/// Adjust `baseURL` when you deploy the backend.
final class APIClient {

    static let shared = APIClient()

    /// For iOS Simulator, 127.0.0.1:3000 works with a locally running backend.
    /// On a physical device, use your Mac's LAN IP instead.
    private let baseURL = URL(string: "http://127.0.0.1:3000")!

    private let session: URLSession
    private let jsonDecoder: JSONDecoder
    private let jsonEncoder: JSONEncoder

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 30

        self.session = URLSession(configuration: config)

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .useDefaultKeys
        decoder.dateDecodingStrategy = .iso8601
        self.jsonDecoder = decoder

        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .useDefaultKeys
        encoder.dateEncodingStrategy = .iso8601
        self.jsonEncoder = encoder
    }

    // MARK: - Public API

    /// POST /interpret
    func interpret(shorthand: String) async throws -> InterpretedWorkoutDTO {
        struct Body: Codable { let shorthand: String }
        let body = Body(shorthand: shorthand)

        return try await request(
            path: "/interpret",
            method: "POST",
            body: body,
            responseType: InterpretedWorkoutDTO.self
        )
    }

    /// POST /generate
    func generate(constraints: GenerateConstraintsDTO) async throws -> GenerateResponseDTO {
        return try await request(
            path: "/generate",
            method: "POST",
            body: constraints,
            responseType: GenerateResponseDTO.self
        )
    }

    /// POST /workouts
    func createWorkout(_ requestDTO: CreateWorkoutRequestDTO) async throws -> CreateWorkoutResponseDTO {
        return try await request(
            path: "/workouts",
            method: "POST",
            body: requestDTO,
            responseType: CreateWorkoutResponseDTO.self
        )
    }

    /// GET /workouts
    func listWorkouts() async throws -> [WorkoutRecordDTO] {
        let response: ListWorkoutsResponseDTO = try await request(
            path: "/workouts",
            method: "GET",
            responseType: ListWorkoutsResponseDTO.self
        )
        return response.workouts
    }

    /// GET /workouts/:id
    func getWorkout(id: String) async throws -> GetWorkoutResponseDTO {
        return try await request(
            path: "/workouts/\(id)",
            method: "GET",
            responseType: GetWorkoutResponseDTO.self
        )
    }

    // MARK: - Core request helpers

    /// Request with JSON body (POST)
    private func request<Body: Encodable, Response: Decodable>(
        path: String,
        method: String,
        body: Body,
        responseType: Response.Type
    ) async throws -> Response {

        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        do {
            request.httpBody = try jsonEncoder.encode(body)
        } catch {
            throw APIError.encodingFailed
        }

        let (data, response) = try await session.data(for: request)

        return try handleResponse(data: data, response: response, path: path)
    }

    /// Request without body (GET)
    private func request<Response: Decodable>(
        path: String,
        method: String,
        responseType: Response.Type
    ) async throws -> Response {

        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)

        return try handleResponse(data: data, response: response, path: path)
    }

    private func handleResponse<Response: Decodable>(
        data: Data,
        response: URLResponse,
        path: String
    ) throws -> Response {

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.noData
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            throw APIError.badStatusCode(httpResponse.statusCode)
        }

        guard !data.isEmpty else {
            throw APIError.noData
        }

        do {
            return try jsonDecoder.decode(Response.self, from: data)
        } catch {
            print("Decoding error for \(path):", error)
            throw APIError.decodingFailed
        }
    }
}
