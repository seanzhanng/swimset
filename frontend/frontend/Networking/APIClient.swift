import Foundation

enum APIError: Error {
    case invalidURL
    case badStatusCode(Int)
    case decodingFailed
    case encodingFailed
    case noData
}

final class APIClient {

    static let shared = APIClient()

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

    func generate(constraints: GenerateConstraintsDTO) async throws -> GenerateResponseDTO {
        return try await request(
            path: "/generate",
            method: "POST",
            body: constraints,
            responseType: GenerateResponseDTO.self
        )
    }

    func createWorkout(_ requestDTO: CreateWorkoutRequestDTO) async throws -> CreateWorkoutResponseDTO {
        return try await request(
            path: "/workouts",
            method: "POST",
            body: requestDTO,
            responseType: CreateWorkoutResponseDTO.self
        )
    }

    func updateWorkout(id: String, requestDTO: UpdateWorkoutRequestDTO) async throws -> GetWorkoutResponseDTO {
        return try await request(
            path: "/workouts/\(id)",
            method: "PUT",
            body: requestDTO,
            responseType: GetWorkoutResponseDTO.self
        )
    }

    func listWorkouts() async throws -> [WorkoutRecordDTO] {
        let response: ListWorkoutsResponseDTO = try await request(
            path: "/workouts",
            method: "GET",
            responseType: ListWorkoutsResponseDTO.self
        )
        return response.workouts
    }

    func getWorkout(id: String) async throws -> GetWorkoutResponseDTO {
        return try await request(
            path: "/workouts/\(id)",
            method: "GET",
            responseType: GetWorkoutResponseDTO.self
        )
    }

    func deleteWorkout(id: String) async throws {
        let path = "/workouts/\(id)"

        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"

        let (_, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.noData
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            throw APIError.badStatusCode(httpResponse.statusCode)
        }
    }

    func getStatsSummary() async throws -> StatsSummaryDTO {
        return try await request(
            path: "/stats/summary",
            method: "GET",
            responseType: StatsSummaryDTO.self
        )
    }

    func downloadWorkoutPDF(id: String, view: String) async throws -> Data {
        let path = "/workouts/\(id)/pdf?view=\(view)"

        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/pdf", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.noData
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            throw APIError.badStatusCode(httpResponse.statusCode)
        }

        guard !data.isEmpty else {
            throw APIError.noData
        }

        return data
    }

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

        return try handleJSONResponse(data: data, response: response, path: path)
    }

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

        return try handleJSONResponse(data: data, response: response, path: path)
    }

    private func handleJSONResponse<Response: Decodable>(
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
